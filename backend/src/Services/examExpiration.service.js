import { Exam } from "../models/exam.models.js";
import { Result } from "../models/result.models.js";
import { decryptQuestionContent, verifyQuestionIntegrity } from "./crypto.service.js";
import { enqueueResultCommitment } from "./integrityOutbox.service.js";


export const startExamExpirationWorker = () => {
    // Run every 30 seconds
    setInterval(async () => {
        try {
            const now = new Date();
            const GRACE_PERIOD_MS = 5 * 60 * 1000;

            // 1. Find all Scheduled exams where scheduledAt has passed
            const scheduledExams = await Exam.find({
                status: "Scheduled",
                scheduledAt: { $lte: now }
            });

            for (const exam of scheduledExams) {
                exam.status = "Live";
                if (!exam.endsAt) {
                    exam.endsAt = new Date(exam.scheduledAt.getTime() + (exam.durationMinutes || 60) * 60 * 1000);
                }
                await exam.save();
                console.log(`[ExamLifecycle] Exam ${exam.title} started and marked as Live.`);
            }

            // 2. Find all Live exams where endsAt has passed, move to GracePeriod
            const liveExams = await Exam.find({
                status: "Live",
                endsAt: { $lt: now }
            });

            for (const exam of liveExams) {
                exam.status = "GracePeriod";
                await exam.save();
                console.log(`[ExamLifecycle] Exam ${exam.title} ended and marked as GracePeriod.`);
            }

            // 3. Find all GracePeriod exams where grace period has expired, move to Completed
            const expiredExams = await Exam.find({
                status: "GracePeriod",
                endsAt: { $lt: new Date(now.getTime() - GRACE_PERIOD_MS) }
            }).populate("questions").populate("examinationId");

            for (const exam of expiredExams) {
                // Find all InProgress results for this exam
                const inProgressResults = await Result.find({
                    exam: exam._id,
                    status: "InProgress",
                    resetByAdmin: { $ne: true }
                }).populate("assignedQuestions").populate("student");

                for (const existingResult of inProgressResults) {
                    await finalizeResult(exam, existingResult);
                }

                exam.status = "Completed";
                await exam.save();
                console.log(`[ExamLifecycle] Exam ${exam.title} finalized and marked as Completed.`);
            }
        } catch (error) {
            console.error("[ExamExpiration] Error in expiration worker:", error);
        }
    }, 30 * 1000);
};

const finalizeResult = async (exam, existingResult) => {
    try {
        let examQuestions = exam.questions;
        if (exam.mode === "Zeroleak") {
            examQuestions = existingResult.assignedQuestions;
        }

        if (!examQuestions || examQuestions.length === 0) {
            existingResult.status = "Completed";
            existingResult.score = 0;
            await existingResult.save();
            return;
        }

        const questionHashes = [];
        const decryptedQuestions = [];

        for (const question of examQuestions) {
            if (!question.encryptedContent || !question.contentHash) {
                continue;
            }
            const isValid = verifyQuestionIntegrity(question.encryptedContent, question.contentHash);
            if (!isValid) {
                continue;
            }
            questionHashes.push(question.contentHash);
            const decryptedContent = decryptQuestionContent(question.encryptedContent);
            decryptedQuestions.push({
                id: String(question._id),
                correctAnswerIndex: decryptedContent.correctAnswerIndex
            });
        }

        const answers = existingResult.latestAnswers || [];
        const answerMap = new Map();
        for (const answer of answers) {
            if (!answer || !answer.questionId) continue;
            answerMap.set(String(answer.questionId), answer.selectedOptionIndex);
        }

        let score = 0;
        for (const question of decryptedQuestions) {
            const submittedAnswer = answerMap.get(question.id);
            if (submittedAnswer !== undefined && Number(submittedAnswer) === Number(question.correctAnswerIndex)) {
                score++;
            }
        }

        const totalQuestions = examQuestions.length;
        existingResult.score = score;
        existingResult.totalQuestions = totalQuestions;
        existingResult.status = "Completed";
        const result = await existingResult.save();

        // --- FABRIC INTEGRITY COMMITMENT ---
        try {
            await enqueueResultCommitment(result);
        } catch (err) {
            console.error('[FABRIC] Failed to enqueue auto-finalized result commitment (reconciler will retry):', err.message);
        }
        console.log(`[ExamExpiration] Result ${result._id} auto-finalized`);
    } catch (err) {
        console.error(`[ExamExpiration] Error finalizing result ${existingResult._id}:`, err);
    }
};
