import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env") });

import connectDB from "../db/index.js";
import { Batch } from "../models/batch.models.js";
import { Question } from "../models/question.models.js";
import { hashQuestionContent } from "../Services/crypto.service.js";

export async function sanitizeAcceptedBatches() {
    console.log("[MIGRATION] Sanitizing accepted batches...");
    await connectDB();

    const acceptedBatches = await Batch.find({ status: "Accepted" });
    console.log(`[MIGRATION] Found ${acceptedBatches.length} accepted batches.`);

    let totalSanitizedQuestions = 0;
    let totalBatchesUpdated = 0;

    for (const batch of acceptedBatches) {
        if (!batch.questions || batch.questions.length === 0) continue;

        let needsUpdate = false;
        const prepared = [];
        const hashesToLookup = [];

        for (const q of batch.questions) {
            // Check if plaintext answer, index, or options exist
            if (
                q.correctAnswer !== undefined ||
                q.correctAnswerIndex !== undefined ||
                (Array.isArray(q.options) && q.options.length > 0) ||
                !q.contentHash
            ) {
                needsUpdate = true;
            }

            let contentHash = q.contentHash;
            if (!contentHash) {
                if (q.title && /^[a-f0-9]{64}$/i.test(q.title)) {
                    contentHash = q.title;
                } else if (q.title) {
                    contentHash = hashQuestionContent({
                        title: q.title,
                        options: q.options || [],
                        correctAnswer: q.correctAnswer || "",
                        correctAnswerIndex: q.correctAnswerIndex ?? 0,
                    });
                }
            }

            if (!q.questionId && contentHash) {
                hashesToLookup.push(contentHash);
            }

            prepared.push({ q, contentHash });
        }

        if (!needsUpdate) {
            console.log(`  Batch "${batch.title}" (${batch._id}) is already sanitized. Skipping.`);
            continue;
        }

        // Bulk lookup question IDs
        const hashToQuestionId = {};
        if (hashesToLookup.length > 0) {
            const foundQuestions = await Question.find({ contentHash: { $in: hashesToLookup } })
                .select("_id contentHash")
                .lean();
            for (const fq of foundQuestions) {
                hashToQuestionId[fq.contentHash] = fq._id;
            }
        }

        const sanitizedQuestions = prepared.map(({ q, contentHash }) => {
            const questionId = q.questionId || (contentHash ? hashToQuestionId[contentHash] : undefined);
            return {
                _id: q._id,
                title: contentHash || "[Encrypted Question Hash]",
                options: [],
                difficultyLevel: q.difficultyLevel,
                subject: q.subject,
                topic: q.topic,
                contentHash,
                questionId,
                createdAt: q.createdAt,
                updatedAt: q.updatedAt,
            };
        });

        await Batch.updateOne(
            { _id: batch._id },
            { $set: { questions: sanitizedQuestions } }
        );
        totalBatchesUpdated++;
        totalSanitizedQuestions += sanitizedQuestions.length;
        console.log(`  Sanitized batch "${batch.title}" (${batch._id}) with ${sanitizedQuestions.length} questions.`);
    }

    console.log(`[MIGRATION] Complete: Updated ${totalBatchesUpdated} batches (${totalSanitizedQuestions} questions scrubbed).`);
    return { totalBatchesUpdated, totalSanitizedQuestions };
}

// Direct execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    sanitizeAcceptedBatches()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error("[MIGRATION] Error:", err);
            process.exit(1);
        });
}
