import * as fabricService from './fabric.service.js';
import { IntegrityOutbox } from '../models/integrityOutbox.models.js';
import { Result } from '../models/result.models.js';
import { Question } from '../models/question.models.js';
import { Exam } from '../models/exam.models.js';
import { decryptQuestionContent, hashQuestionContent } from './crypto.service.js';
import { buildMerkleRoot } from './merkle.service.js';

// Verify a Result
export async function verifyResult(resultId, targetVersion = null) {
    const result = await Result.findById(resultId).lean();
    if (!result) {
        return _notFound('Result', resultId);
    }

    const entityId = result._id.toString();
    let version = targetVersion;
    if (!version) {
        const latestOutbox = await IntegrityOutbox.findOne({
            entityType: 'Result',
            entityId,
            status: 'CONFIRMED'
        }).sort({ version: -1 }).lean();
        version = latestOutbox ? latestOutbox.version : 1;
    }
    const commitmentId = fabricService.buildCommitmentId('Result', entityId, version);

    const canonical = {
        _id: entityId,
        student: result.student?.toString(),
        exam: result.exam?.toString(),
        score: result.score,
        totalQuestions: result.totalQuestions,
        status: result.status,
        isTerminated: result.isTerminated,
        assignedQuestions: (result.assignedQuestions || []).map(q => q?.toString()).sort(),
        createdAt: result.createdAt instanceof Date ? result.createdAt.toISOString() : result.createdAt,
    };

    const computedHash = fabricService.computeDataHash(canonical);

    return _verifyAgainstLedger({
        entityId,
        entityType: 'Result',
        commitmentId,
        computedHash,
    });
}


// Verify a Batch
export async function verifyBatch(batchId, targetVersion = null) {
    const { Batch } = await import('../models/batch.models.js');
    const batch = await Batch.findById(batchId).lean();
    if (!batch) {
        return _notFound('Batch', batchId);
    }

    const entityId = batch._id.toString();
    let version = targetVersion;
    if (!version) {
        const latestOutbox = await IntegrityOutbox.findOne({
            entityType: 'Batch',
            entityId,
            status: 'CONFIRMED'
        }).sort({ version: -1 }).lean();
        version = latestOutbox ? latestOutbox.version : 1;
    }
    const commitmentId = fabricService.buildCommitmentId('Batch', entityId, version);

    if (batch.status !== 'Accepted') {
        return {
            valid: false,
            entityId,
            entityType: 'Batch',
            commitmentId,
            computedHash: null,
            ledgerHash: null,
            reason: 'NOT_ACCEPTED',
            message: `Batch status is "${batch.status}". Only Accepted batches have blockchain commitments.`,
            verifiedAt: new Date().toISOString(),
        };
    }

    if (!batch.questions || batch.questions.length === 0) {
        return {
            valid: false,
            entityId,
            entityType: 'Batch',
            commitmentId,
            computedHash: null,
            ledgerHash: null,
            reason: 'EMPTY_BATCH',
            message: `Batch has no questions to verify.`,
            verifiedAt: new Date().toISOString(),
        };
    }

    // Dynamic Merkle Root Reconstruction:
    // Reconstruct the Merkle root from current question documents in the Question Bank,
    // verifying that decrypted content and metadata (subject, topic, difficultyLevel) match.
    const questionIds = (batch.questions || []).map(q => q.questionId).filter(Boolean);
    const contentHashesFromBatch = (batch.questions || []).map(q => q.contentHash).filter(Boolean);

    const questionDocs = await Question.find({
        $or: [
            ...(questionIds.length > 0 ? [{ _id: { $in: questionIds } }] : []),
            ...(contentHashesFromBatch.length > 0 ? [{ contentHash: { $in: contentHashesFromBatch } }] : []),
        ]
    }).lean();

    const idToDocMap = new Map();
    const hashToDocMap = new Map();
    for (const doc of questionDocs) {
        idToDocMap.set(doc._id.toString(), doc);
        if (doc.contentHash) hashToDocMap.set(doc.contentHash, doc);
    }

    const reconstructedQuestionHashes = [];

    for (let i = 0; i < batch.questions.length; i++) {
        const qRef = batch.questions[i];
        const questionDoc = (qRef.questionId && idToDocMap.get(qRef.questionId.toString()))
            || (qRef.contentHash && hashToDocMap.get(qRef.contentHash));

        if (!questionDoc) {
            return {
                valid: false,
                entityId,
                entityType: 'Batch',
                commitmentId,
                computedHash: null,
                ledgerHash: null,
                reason: 'QUESTION_MISSING',
                message: `Question #${i + 1} from batch (id: ${qRef.questionId || qRef._id}) was not found in the Question Bank. Underlying data has been deleted or corrupted.`,
                verifiedAt: new Date().toISOString(),
            };
        }

        // Verify metadata between batch subdoc and Question doc
        if (qRef.subject && questionDoc.subject && qRef.subject !== questionDoc.subject) {
            return {
                valid: false,
                entityId,
                entityType: 'Batch',
                commitmentId,
                computedHash: null,
                ledgerHash: null,
                reason: 'METADATA_MISMATCH',
                message: `Question #${i + 1} subject mismatch: batch has "${qRef.subject}" but Question Bank has "${questionDoc.subject}". Data was altered.`,
                verifiedAt: new Date().toISOString(),
            };
        }

        if (qRef.difficultyLevel && questionDoc.difficultyLevel && qRef.difficultyLevel !== questionDoc.difficultyLevel) {
            return {
                valid: false,
                entityId,
                entityType: 'Batch',
                commitmentId,
                computedHash: null,
                ledgerHash: null,
                reason: 'METADATA_MISMATCH',
                message: `Question #${i + 1} difficulty mismatch: batch has "${qRef.difficultyLevel}" but Question Bank has "${questionDoc.difficultyLevel}". Data was altered.`,
                verifiedAt: new Date().toISOString(),
            };
        }

        if (qRef.topic && questionDoc.topic && qRef.topic !== questionDoc.topic) {
            return {
                valid: false,
                entityId,
                entityType: 'Batch',
                commitmentId,
                computedHash: null,
                ledgerHash: null,
                reason: 'METADATA_MISMATCH',
                message: `Question #${i + 1} topic mismatch: batch has "${qRef.topic}" but Question Bank has "${questionDoc.topic}". Data was altered.`,
                verifiedAt: new Date().toISOString(),
            };
        }

        // Decrypt question content
        let decrypted;
        try {
            decrypted = decryptQuestionContent(questionDoc.encryptedContent);
        } catch (decErr) {
            return {
                valid: false,
                entityId,
                entityType: 'Batch',
                commitmentId,
                computedHash: null,
                ledgerHash: null,
                reason: 'DECRYPTION_FAILED',
                message: `Failed to decrypt question #${i + 1} (${questionDoc._id}): ${decErr.message}. Ciphertext or authTag has been tampered with.`,
                verifiedAt: new Date().toISOString(),
            };
        }

        // Recompute content hash using decrypted content AND metadata (subject, topic, difficultyLevel)
        const sensitiveWithMeta = {
            title: decrypted.title,
            options: decrypted.options,
            correctAnswer: decrypted.correctAnswer,
            correctAnswerIndex: decrypted.correctAnswerIndex,
            subject: questionDoc.subject || qRef.subject || decrypted.subject,
            topic: questionDoc.topic || qRef.topic || decrypted.topic,
            difficultyLevel: questionDoc.difficultyLevel || qRef.difficultyLevel || decrypted.difficultyLevel,
        };

        let calculatedQHash = hashQuestionContent(sensitiveWithMeta);

        // Support both metadata-inclusive hash and legacy format
        if (calculatedQHash !== questionDoc.contentHash) {
            const legacyHash = hashQuestionContent({
                title: decrypted.title,
                options: decrypted.options,
                correctAnswer: decrypted.correctAnswer,
                correctAnswerIndex: decrypted.correctAnswerIndex,
            });

            if (legacyHash === questionDoc.contentHash) {
                calculatedQHash = legacyHash;
            } else {
                return {
                    valid: false,
                    entityId,
                    entityType: 'Batch',
                    commitmentId,
                    computedHash: null,
                    ledgerHash: null,
                    reason: 'QUESTION_TAMPERED',
                    message: `Question #${i + 1} (${questionDoc._id}) content hash does not match decrypted content and metadata. Question data has been tampered with.`,
                    verifiedAt: new Date().toISOString(),
                };
            }
        }

        reconstructedQuestionHashes.push(calculatedQHash);
    }

    // Reconstruct Merkle root from freshly verified question hashes
    const reconstructedMerkleRoot = buildMerkleRoot(reconstructedQuestionHashes);

    if (!reconstructedMerkleRoot) {
        return {
            valid: false,
            entityId,
            entityType: 'Batch',
            commitmentId,
            computedHash: null,
            ledgerHash: null,
            reason: 'NO_MERKLE_ROOT',
            message: `Could not build Merkle root from question hashes.`,
            verifiedAt: new Date().toISOString(),
        };
    }

    // Verify reconstructed root matches saved batch root
    if (batch.merkleRoot && batch.merkleRoot !== reconstructedMerkleRoot) {
        return {
            valid: false,
            entityId,
            entityType: 'Batch',
            commitmentId,
            computedHash: reconstructedMerkleRoot,
            ledgerHash: batch.merkleRoot,
            reason: 'MERKLE_ROOT_MISMATCH',
            message: `Reconstructed Merkle root from current questions (${reconstructedMerkleRoot}) does not match saved batch Merkle root (${batch.merkleRoot}). Underlying question data or root has been modified.`,
            verifiedAt: new Date().toISOString(),
        };
    }

    const computedHash = reconstructedMerkleRoot;

    return _verifyAgainstLedger({
        entityId,
        entityType: 'Batch',
        commitmentId,
        computedHash,
    });
}


// Verify an Exam
export async function verifyExam(examId, targetVersion = null) {
    const exam = await Exam.findById(examId).populate('questions').lean();
    if (!exam) {
        return _notFound('Exam', examId);
    }

    const entityId = exam._id.toString();
    let version = targetVersion;
    if (!version) {
        const latestOutbox = await IntegrityOutbox.findOne({
            entityType: 'Exam',
            entityId,
            status: 'CONFIRMED'
        }).sort({ version: -1 }).lean();
        version = latestOutbox ? latestOutbox.version : 1;
    }
    const commitmentId = fabricService.buildCommitmentId('Exam', entityId, version);

    // FIX: Recompute the Merkle root dynamically from the actually assigned questions and metadata
    let dynamicMerkleRoot = '';
    if (exam.mode !== 'Zeroleak') {
        const questionHashes = [];
        for (const question of (exam.questions || [])) {
            try {
                const decryptedContent = decryptQuestionContent(question.encryptedContent);
                const sensitiveWithMeta = {
                    title: decryptedContent.title,
                    options: decryptedContent.options,
                    correctAnswer: decryptedContent.correctAnswer,
                    correctAnswerIndex: decryptedContent.correctAnswerIndex,
                    subject: question.subject || decryptedContent.subject,
                    topic: question.topic || decryptedContent.topic,
                    difficultyLevel: question.difficultyLevel || decryptedContent.difficultyLevel,
                };
                let qHash = hashQuestionContent(sensitiveWithMeta);
                if (qHash !== question.contentHash) {
                    const legacyHash = hashQuestionContent(decryptedContent);
                    if (legacyHash === question.contentHash) {
                        qHash = legacyHash;
                    }
                }
                questionHashes.push(qHash);
            } catch (err) {
                return {
                    valid: false,
                    entityId,
                    entityType: 'Exam',
                    commitmentId,
                    computedHash: null,
                    ledgerHash: null,
                    reason: 'DECRYPTION_FAILED',
                    message: `Failed to decrypt an assigned question (${question._id}): ${err.message}. Exam is compromised.`,
                    verifiedAt: new Date().toISOString(),
                };
            }
        }
        dynamicMerkleRoot = buildMerkleRoot(questionHashes);
    }

    const canonical = {
        _id: entityId,
        title: exam.title,
        subject: exam.subject,
        mode: exam.mode,
        questionMerkleRoot: dynamicMerkleRoot,
        durationMinutes: exam.durationMinutes,
        totalMarks: exam.totalMarks,
        scheduledAt: exam.scheduledAt instanceof Date ? exam.scheduledAt.toISOString() : exam.scheduledAt,
        createdAt: exam.createdAt instanceof Date ? exam.createdAt.toISOString() : exam.createdAt,
        questionCount: (exam.questions || []).length,
    };

    const computedHash = fabricService.computeDataHash(canonical);

    return _verifyAgainstLedger({
        entityId,
        entityType: 'Exam',
        commitmentId,
        computedHash,
    });
}


// Verify a Security Event (generic — event must be in outbox)
export async function verifySecurityEvent(eventId) {
    const outboxRecord = await IntegrityOutbox.findOne({
        entityType: 'SecurityEvent',
        entityId: eventId,
        status: 'CONFIRMED',
    }).lean();

    if (!outboxRecord) {
        return {
            valid: false,
            entityId: eventId,
            entityType: 'SecurityEvent',
            reason: 'COMMITMENT_NOT_FOUND',
            message: 'No confirmed Fabric commitment found for this security event.',
            verifiedAt: new Date().toISOString(),
        };
    }

    return _verifyAgainstLedger({
        entityId: eventId,
        entityType: 'SecurityEvent',
        commitmentId: outboxRecord.commitmentId,
        computedHash: outboxRecord.dataHash,
    });
}


// Get outbox status for an entity (useful for admin/auditor UI)
export async function getOutboxStatus(entityType, entityId) {
    const records = await IntegrityOutbox.find({ entityType, entityId })
        .sort({ version: 1 })
        .lean();

    return records.map(r => ({
        commitmentId: r.commitmentId,
        status: r.status,
        version: r.version,
        dataHash: r.dataHash,
        fabricTxId: r.fabricTxId,
        fabricBlockTimestamp: r.fabricBlockTimestamp,
        fabricHeight: r.fabricHeight,
        attemptCount: r.attemptCount,
        lastError: r.lastError,
        confirmedAt: r.confirmedAt,
        createdAt: r.createdAt,
    }));
}


// Internal helpers
async function _verifyAgainstLedger({ entityId, entityType, commitmentId, computedHash }) {
    try {
        const fabricResult = await fabricService.verifyCommitment(commitmentId, computedHash);

        // Fetch outbox metadata if available for block height & confirmed tx info
        let outboxRecord = await IntegrityOutbox.findOne({ commitmentId }).lean();
        if (!outboxRecord) {
            outboxRecord = await IntegrityOutbox.findOne({
                entityId,
                entityType,
                status: 'CONFIRMED'
            }).sort({ version: -1, fabricHeight: -1 }).lean();
        }

        const txId = fabricResult.txId || outboxRecord?.fabricTxId || null;
        const blockHeight = outboxRecord?.fabricHeight ?? (fabricResult.height || null);
        const blockTimestamp = fabricResult.blockTimestamp || outboxRecord?.fabricBlockTimestamp || null;

        return {
            valid: fabricResult.valid,
            entityId,
            entityType,
            commitmentId,
            computedHash,
            ledgerHash: fabricResult.storedHash,
            ledgerVersion: fabricResult.version,
            txId,
            fabricTxId: txId,
            blockHeight,
            fabricBlockHeight: blockHeight,
            blockTimestamp,
            fabricBlockTimestamp: blockTimestamp,
            reason: fabricResult.reason,
            verifiedAt: new Date().toISOString(),
        };

    } catch (err) {
        const code = err.code || 'FABRIC_ERROR';

        if (code === 'COMMITMENT_NOT_FOUND') {
            // Check if it's pending in the outbox
            let outboxRecord = await IntegrityOutbox.findOne({ commitmentId }).lean();
            if (!outboxRecord) {
                outboxRecord = await IntegrityOutbox.findOne({ entityId, entityType }).sort({ version: -1 }).lean();
            }
            const outboxStatus = outboxRecord?.status || 'NOT_IN_OUTBOX';

            return {
                valid: false,
                entityId,
                entityType,
                commitmentId,
                computedHash,
                ledgerHash: null,
                txId: outboxRecord?.fabricTxId || null,
                fabricTxId: outboxRecord?.fabricTxId || null,
                blockHeight: outboxRecord?.fabricHeight ?? null,
                fabricBlockHeight: outboxRecord?.fabricHeight ?? null,
                blockTimestamp: outboxRecord?.fabricBlockTimestamp || null,
                fabricBlockTimestamp: outboxRecord?.fabricBlockTimestamp || null,
                reason: 'COMMITMENT_NOT_FOUND',
                outboxStatus,
                message: `No commitment found on ledger. Outbox status: ${outboxStatus}`,
                verifiedAt: new Date().toISOString(),
            };
        }

        return {
            valid: false,
            entityId,
            entityType,
            commitmentId,
            computedHash,
            ledgerHash: null,
            reason: code,
            message: `Fabric verification error: ${err.message}`,
            verifiedAt: new Date().toISOString(),
        };
    }
}

function _notFound(entityType, entityId) {
    return {
        valid: false,
        entityId,
        entityType,
        reason: 'ENTITY_NOT_FOUND',
        message: `${entityType} with id '${entityId}' was not found in MongoDB.`,
        verifiedAt: new Date().toISOString(),
    };
}
