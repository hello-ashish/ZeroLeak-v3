import mongoose from 'mongoose';

const integrityOutboxSchema = new mongoose.Schema({
    commitmentId: { type: String, required: true, unique: true },
    eventType: { type: String, enum: ['RESULT_COMMITMENT', 'EXAM_COMMITMENT', 'SECURITY_EVENT', 'BATCH_COMMITMENT'], required: true },
    entityType: { type: String, enum: ['Result', 'Exam', 'SecurityEvent', 'Batch'], required: true },
    entityId: { type: String, required: true },
    dataHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    previousCommitmentHash: { type: String, default: '' },
    version: { type: Number, default: 1, min: 1 },
    eventTimestamp: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED'], default: 'PENDING', index: true },
    processingWorker: { type: String, default: null },
    leaseExpiresAt: { type: Date, default: null },
    fabricTxId: { type: String, default: null },
    fabricBlockTimestamp: { type: String, default: null },
    fabricHeight: { type: Number, default: null },
    attemptCount: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    lastError: { type: String, default: null },
    lastErrorCode: { type: String, default: null },
    confirmedAt: { type: Date, default: null },
}, {
    timestamps: true,
});

integrityOutboxSchema.index({ status: 1, createdAt: 1 });
integrityOutboxSchema.index({ status: 1, leaseExpiresAt: 1 });
integrityOutboxSchema.index({ entityId: 1, entityType: 1 });

export const IntegrityOutbox = mongoose.model('IntegrityOutbox', integrityOutboxSchema);
