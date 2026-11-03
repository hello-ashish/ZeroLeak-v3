import crypto from "crypto";
import { Question } from "../models/question.models.js";
import { Exam } from "../models/exam.models.js";
import {
    encryptQuestionContent,
    hashQuestionContent,
    decryptQuestionContent,
} from "../Services/crypto.service.js"
import { selectQuestionsByDifficultyRatio } from "../Services/question.service.js";
import { AuditLog } from "../models/auditlog.models.js";

export const createQuestion = async (req, res) => {
    try {
        const {
            title,
            options,
            correctAnswer,
            difficultyLevel,
            subject,
            topic,
            correctAnswerIndex,
        } = req.body

        if (
            !title ||
            !options ||
            !correctAnswer ||
            !difficultyLevel ||
            !subject ||
            !topic ||
            correctAnswerIndex === undefined
        ) {
            return res.status(400).json({
                message: "All fields are required",
            })
        }

        // Sensitive question data including subject, topic, and difficulty metadata
        const sensitiveContent = {
            title,
            options,
            correctAnswer,
            correctAnswerIndex,
            subject,
            topic,
            difficultyLevel,
        }

        // Create SHA-256 integrity fingerprint
        const contentHash =
            hashQuestionContent(sensitiveContent)

        // Encrypt sensitive question data
        const encryptedContent =
            encryptQuestionContent(sensitiveContent)

        // Store only encrypted sensitive content
        const question = await Question.create({
            encryptedContent,
            contentHash,
            difficultyLevel,
            subject,
            topic,
            createdBy: req.professor._id,
        })

        // Questions are committed to blockchain only via accepted Batches (Merkle root)
        // Audit Log
        try {
            await AuditLog.create({
                actor: req.professor?.email || "Professor",
                actorRole: "Professor",
                action: "QUESTION_CREATED",
                targetType: "Question",
                targetId: String(question._id),
                targetLabel: `${subject} - ${topic}`,
                details: `Created ${difficultyLevel} question for ${subject}/${topic}.`,
                status: "success"
            });
        } catch (auditErr) {
            console.error("[QUESTION] AuditLog error:", auditErr.message);
        }

        return res.status(201).json({
            message: "Question created successfully",
            question,
        })
    } catch (error) {
        console.error("Error creating question: ", error)

        return res.status(500).json({
            message: "Internal server error while creating question",
        })
    }
}

export const getProfessorQuestions = async (req, res) => {
    try {
        const questions = await Question.find({
            createdBy: req.professor._id,
        })
            .sort({ createdAt: -1 })
            .lean()

        const safeQuestions = questions.map((question) => {
            let decryptedContent = {}

            try {
                if (question.encryptedContent) {
                    decryptedContent =
                        decryptQuestionContent(
                            question.encryptedContent
                        )
                }
            } catch (error) {
                console.error(
                    `Unable to decrypt question ${question._id}:`,
                    error.message
                )
            }

            return {
                _id: question._id,
                title:
                    decryptedContent.title ||
                    "[Protected Question]",
                options:
                    decryptedContent.options || [],
                correctAnswerIndex:
                    decryptedContent.correctAnswerIndex,
                difficultyLevel:
                    question.difficultyLevel,
                subject: question.subject,
                topic: question.topic,
                createdAt: question.createdAt,
            }
        })

        return res.status(200).json({
            message: "Questions fetched successfully",
            questions: safeQuestions,
        })

    } catch (error) {
        console.error(
            "Error fetching questions: ",
            error
        )

        return res.status(500).json({
            message:
                "Something went wrong while fetching questions",
        })
    }
}
export const getAllQuestions = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', difficulty = '', subject = '', decrypt = 'false' } = req.query;

        const filter = {};
        if (difficulty) {
            filter.difficultyLevel = difficulty.toLowerCase();
        }
        if (subject) {
            filter.subject = new RegExp(`^${subject}$`, 'i');
        }
        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            filter.$or = [
                { topic: searchRegex },
                { subject: searchRegex },
                { contentHash: searchRegex }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
        const skip = (pageNum - 1) * limitNum;

        // Run paginated fetch, count, and global stats aggregation in parallel
        const [questions, totalFiltered, aggResult] = await Promise.all([
            Question.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Question.countDocuments(filter),
            Question.aggregate([
                {
                    $group: {
                        _id: { subject: "$subject", topic: "$topic", difficulty: "$difficultyLevel" },
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        const questionIds = questions.map(q => q._id);
        const usageAgg = questionIds.length > 0 ? await Exam.aggregate([
            { $match: { questions: { $in: questionIds } } },
            { $unwind: "$questions" },
            { $match: { questions: { $in: questionIds } } },
            { $group: { _id: "$questions", usageCount: { $sum: 1 } } }
        ]) : [];

        const usageMap = {};
        usageAgg.forEach(u => { usageMap[String(u._id)] = u.usageCount; });

        const formatString = (str) => {
            if (!str) return str;
            return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        };

        // Decrypt only the questions on the requested page if requested
        const paginated = questions.map((question) => {
            let decryptedContent = {};
            if (decrypt === 'true' && question.encryptedContent) {
                try {
                    decryptedContent = decryptQuestionContent(question.encryptedContent);
                } catch (error) {
                    console.error("Failed to decrypt in getAllQuestions:", error.message);
                }
            }

            return {
                _id: question._id,
                title: decrypt === 'true' && decryptedContent.title ? decryptedContent.title : (question.contentHash || "[Encrypted Question Hash]"),
                options: decrypt === 'true' && decryptedContent.options ? decryptedContent.options : [],
                correctAnswerIndex: decrypt === 'true' ? decryptedContent.correctAnswerIndex : null,
                difficultyLevel: question.difficultyLevel,
                subject: formatString(question.subject),
                topic: formatString(question.topic),
                createdBy: question.createdBy,
                createdAt: question.createdAt,
                health: {
                    usageCount: usageMap[String(question._id)] || 0,
                    successRate: 0,
                    flagged: false,
                },
            };
        });

        // Compute global stats and charts from lightweight aggregation
        let total = 0;
        let easy = 0;
        let medium = 0;
        let hard = 0;
        const subjectsSet = new Set();
        const subjectDiffMap = {};
        const topicDiffMap = {};

        aggResult.forEach(item => {
            const count = item.count;
            total += count;
            const diff = (item._id.difficulty || '').toLowerCase();
            if (diff === 'easy') easy += count;
            else if (diff === 'medium') medium += count;
            else if (diff === 'hard') hard += count;

            const sub = formatString(item._id.subject) || 'General';
            subjectsSet.add(sub);

            if (!subjectDiffMap[sub]) subjectDiffMap[sub] = { Easy: 0, Medium: 0, Hard: 0 };
            if (diff === 'easy') subjectDiffMap[sub].Easy += count;
            else if (diff === 'medium') subjectDiffMap[sub].Medium += count;
            else if (diff === 'hard') subjectDiffMap[sub].Hard += count;

            const top = formatString(item._id.topic) || 'General';
            if (!topicDiffMap[sub]) topicDiffMap[sub] = {};
            if (!topicDiffMap[sub][top]) topicDiffMap[sub][top] = { Easy: 0, Medium: 0, Hard: 0 };
            if (diff === 'easy') topicDiffMap[sub][top].Easy += count;
            else if (diff === 'medium') topicDiffMap[sub][top].Medium += count;
            else if (diff === 'hard') topicDiffMap[sub][top].Hard += count;
        });

        const subjects = Array.from(subjectsSet).sort();
        const chartDataAll = subjects.map(sub => ({
            name: sub,
            Easy: subjectDiffMap[sub]?.Easy || 0,
            Medium: subjectDiffMap[sub]?.Medium || 0,
            Hard: subjectDiffMap[sub]?.Hard || 0,
        }));

        const topicsBySubject = {};
        subjects.forEach(sub => {
            topicsBySubject[sub] = Object.entries(topicDiffMap[sub] || {}).map(([topName, diffCounts]) => ({
                name: topName,
                Easy: diffCounts.Easy,
                Medium: diffCounts.Medium,
                Hard: diffCounts.Hard,
            }));
        });

        const stats = {
            total,
            easy,
            medium,
            hard,
            highSuccess: 0,
            lowSuccess: 0,
            flagged: 0
        };

        return res.status(200).json({
            message: "Questions fetched successfully",
            questions: paginated,
            totalFiltered,
            stats,
            subjects,
            chartDataAll,
            topicsBySubject
        });

    } catch (error) {
        console.error("Error fetching all questions: ", error);
        return res.status(500).json({
            message: "Something went wrong while fetching all questions",
        });
    }
}

export const simulatePaper = async (req, res) => {
    try {
        const { subject, numQuestions = 10 } = req.query;
        if (!subject) return res.status(400).json({ message: "Subject is required" });

        const count = Number(numQuestions) || 10;
        const numEasy = Math.round(count * 0.4);
        const numMedium = Math.round(count * 0.3);
        const numHard = count - numEasy - numMedium;

        const subjectRegex = new RegExp(`^${subject}$`, 'i');

        // Sample directly from database for ultra-fast response
        const [easyQs, medQs, hardQs] = await Promise.all([
            Question.aggregate([{ $match: { subject: subjectRegex, difficultyLevel: 'easy' } }, { $sample: { size: numEasy } }]),
            Question.aggregate([{ $match: { subject: subjectRegex, difficultyLevel: 'medium' } }, { $sample: { size: numMedium } }]),
            Question.aggregate([{ $match: { subject: subjectRegex, difficultyLevel: 'hard' } }, { $sample: { size: numHard } }])
        ]);

        let selectedQuestions = [...easyQs, ...medQs, ...hardQs];

        if (selectedQuestions.length < count) {
            const needed = count - selectedQuestions.length;
            const existingIds = selectedQuestions.map(q => q._id);
            const extra = await Question.aggregate([
                { $match: { subject: subjectRegex, _id: { $nin: existingIds } } },
                { $sample: { size: needed } }
            ]);
            selectedQuestions.push(...extra);
        }

        if (selectedQuestions.length === 0) {
            return res.status(404).json({ message: "No questions found for this subject" });
        }

        // Shuffle
        for (let i = selectedQuestions.length - 1; i > 0; i--) {
            const j = crypto.randomInt(0, i + 1);
            [selectedQuestions[i], selectedQuestions[j]] = [selectedQuestions[j], selectedQuestions[i]];
        }

        const decryptedQuestions = selectedQuestions.map(question => {
            let decryptedContent = {};
            try {
                if (question.encryptedContent) {
                    decryptedContent = decryptQuestionContent(question.encryptedContent);
                }
            } catch (error) {
                console.error("Simulation decryption failed:", error.message);
            }
            return {
                _id: question._id,
                title: decryptedContent.title || (question.contentHash || "[Encrypted Question Hash]"),
                options: decryptedContent.options || [],
                correctAnswerIndex: decryptedContent.correctAnswerIndex ?? null,
                difficultyLevel: question.difficultyLevel,
                subject: question.subject,
                topic: question.topic
            };
        });

        return res.status(200).json({
            message: "Paper simulated securely",
            questions: decryptedQuestions
        });
    } catch (error) {
        console.error("Error simulating paper:", error);
        return res.status(500).json({ message: "Failed to simulate paper" });
    }
};