import { IntegrityOutbox } from '../models/integrityOutbox.models.js';
import * as fabricService from './fabric.service.js';
import os from 'os';

const WORKER_ID = `${os.hostname()}-${process.pid}`;
const POLL_INTERVAL_MS = 15_000;        // Poll every 15 seconds
const LEASE_DURATION_MS = 120_000;      // 2-minute lease per record
const BATCH_SIZE = 10;                   // Process up to 10 records per cycle

let _workerInterval = null;


// Outbox record creation (called by application code)
/**
 * @param {Object} opts
 * @param {string} opts.commitmentId  - Deterministic Fabric commitment ID
 * @param {string} opts.eventType     - RESULT_COMMITMENT | EXAM_COMMITMENT | SECURITY_EVENT | BATCH_COMMITMENT
 * @param {string} opts.entityType    - Result | Exam | SecurityEvent | Batch
 * @param {string} opts.entityId      - MongoDB ObjectId hex string
 * @param {string} opts.dataHash      - SHA-256 hex
 * @param {string} [opts.previousCommitmentHash] - SHA-256 or ''
 * @param {number} [opts.version]     - monotonic version >= 1
 */
export async function enqueueCommitment({
    commitmentId,
    eventType,
    entityType,
    entityId,
    dataHash,
    previousCommitmentHash = '',
    version = 1,
}) {
    // Remove the early return so that records are durably queued in MongoDB 
    // even if Fabric is disabled. This allows a controlled backfill later.

    try {
        const record = await IntegrityOutbox.create({
            commitmentId,
            eventType,
            entityType,
            entityId,
            dataHash,
            previousCommitmentHash,
            version,
            eventTimestamp: new Date().toISOString(),
            status: 'PENDING',
        });
        console.info(`[OUTBOX] Enqueued commitment id=${commitmentId} entityType=${entityType} entityId=${entityId}`);
        return record;
    } catch (err) {
        if (err.code === 11000) {
            // Duplicate — already enqueued, safe to ignore
            console.warn(`[OUTBOX] Commitment ${commitmentId} already in outbox — skipping duplicate enqueue.`);
            return null;
        }
        console.error(`[OUTBOX] Failed to enqueue commitment ${commitmentId}: ${err.message}`);
        throw err;
    }
}


// Worker
export function startIntegrityOutboxWorker() {
    if (_workerInterval) return; // Already running

    console.info(`[OUTBOX] Starting IntegrityOutbox worker (workerId=${WORKER_ID}, poll=${POLL_INTERVAL_MS}ms)`);

    _workerInterval = setInterval(async () => {
        try {
            await _processBatch();
        } catch (err) {
            console.error(`[OUTBOX] Worker error: ${err.message}`);
        }
    }, POLL_INTERVAL_MS);

    // Run once immediately on startup
    setTimeout(() => _processBatch().catch(e => console.error('[OUTBOX] Initial batch error:', e.message)), 2000);
}

async function _processBatch() {
    if (_recommitJob && _recommitJob.status === 'running') {
        return;
    }

    const now = new Date();
    const leaseExpiry = new Date(now.getTime() + LEASE_DURATION_MS);

    const claims = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
        const baseFilter = {
            $or: [
                { status: 'PENDING' },
                {
                    status: 'PROCESSING',
                    leaseExpiresAt: { $lt: now }, // Lease expired — safe to reclaim
                },
            ],
            $expr: { $lt: ['$attemptCount', '$maxAttempts'] },
            entityType: { $ne: 'Question' },
        };

        const updateDoc = {
            $set: {
                status: 'PROCESSING',
                processingWorker: WORKER_ID,
                leaseExpiresAt: leaseExpiry,
            },
            $inc: { attemptCount: 1 },
        };

        // Priority 1: Structural commitments (SecurityEvent, Batch, Exam)
        let claimed = await IntegrityOutbox.findOneAndUpdate(
            {
                ...baseFilter,
                entityType: { $in: ['SecurityEvent', 'Batch', 'Exam'] },
            },
            updateDoc,
            {
                sort: { createdAt: 1 },
                returnDocument: 'after',
            }
        );

        // Priority 2: Results (process newest first so active exam submissions aren't blocked by bulk backlog)
        if (!claimed) {
            claimed = await IntegrityOutbox.findOneAndUpdate(
                baseFilter,
                updateDoc,
                {
                    sort: { createdAt: -1 },
                    returnDocument: 'after',
                }
            );
        }

        if (!claimed) break;
        claims.push(claimed);
    }

    if (claims.length === 0) return;

    console.info(`[OUTBOX] Worker ${WORKER_ID} claimed ${claims.length} record(s).`);

    for (const record of claims) {
        await _processRecord(record);
        // Small delay between transactions to give Raft consensus time to cut the block
        await new Promise(r => setTimeout(r, 200));
    }
}

async function _processRecord(record) {
    const { commitmentId, eventType, entityType, entityId, dataHash, previousCommitmentHash, version, eventTimestamp } = record;

    try {
        const result = await fabricService.createCommitment({
            id: commitmentId,
            eventType,
            entityType,
            entityId,
            dataHash,
            previousCommitmentHash,
            version,
            timestamp: eventTimestamp,
        });

        if (result.status === 'CONFIRMED' || result.status === 'DUPLICATE') {
            await IntegrityOutbox.findByIdAndUpdate(record._id, {
                $set: {
                    status: 'CONFIRMED',
                    fabricTxId: result.txId || null,
                    fabricBlockTimestamp: result.blockTimestamp || null,
                    fabricHeight: result.height || null,
                    lastError: null,
                    lastErrorCode: null,
                    confirmedAt: new Date(),
                    processingWorker: null,
                    leaseExpiresAt: null,
                },
            });
            console.info(`[OUTBOX] CONFIRMED commitmentId=${commitmentId} txId=${result.txId}`);
        } else if (result.status === 'FABRIC_DISABLED') {
            await IntegrityOutbox.findByIdAndUpdate(record._id, {
                $set: { status: 'PENDING', processingWorker: null, leaseExpiresAt: null },
                $inc: { attemptCount: -1 }, // Don't count this as a failed attempt
            });
        }

    } catch (err) {
        const errCode = err.code || 'UNKNOWN';
        const errMsg = err.message || 'Unknown error';

        console.error(`[OUTBOX] FAILED commitmentId=${commitmentId} code=${errCode} error=${errMsg}`);

        const updatedRecord = await IntegrityOutbox.findById(record._id);
        const shouldPermanentlyFail = updatedRecord && updatedRecord.attemptCount >= updatedRecord.maxAttempts;

        await IntegrityOutbox.findByIdAndUpdate(record._id, {
            $set: {
                status: shouldPermanentlyFail ? 'FAILED' : 'PENDING',
                lastError: errMsg.substring(0, 500), // Cap to prevent huge error strings
                lastErrorCode: errCode,
                processingWorker: null,
                leaseExpiresAt: null,
            },
        });
    }
}


// Application-level helpers
export async function enqueueResultCommitment(result) {

    const entityId = result._id.toString();
    // Derive commitment version from result.__v or result.version to support result revisions
    const version = (typeof result.version === 'number' && result.version > 0)
        ? result.version
        : (typeof result.__v === 'number' ? result.__v + 1 : 1);

    const canonical = {
        _id: entityId,
        student: result.student?.toString() || result.student,
        exam: result.exam?.toString() || result.exam,
        score: result.score,
        totalQuestions: result.totalQuestions,
        status: result.status,
        isTerminated: result.isTerminated,
        assignedQuestions: (result.assignedQuestions || []).map(q => (q && q._id ? q._id.toString() : q?.toString() || q)).sort(),
        createdAt: result.createdAt instanceof Date ? result.createdAt.toISOString() : result.createdAt,
    };

    const dataHash = fabricService.computeDataHash(canonical);
    const commitmentId = fabricService.buildCommitmentId('Result', entityId, version);

    return enqueueCommitment({
        commitmentId,
        eventType: 'RESULT_COMMITMENT',
        entityType: 'Result',
        entityId,
        dataHash,
        previousCommitmentHash: '',
        version,
    });
}

export async function enqueueSecurityEventCommitment(securityEvent, version = 1, previousHash = '') {
    const entityId = (securityEvent._id || securityEvent.id).toString();
    const commitmentId = fabricService.buildCommitmentId('SecurityEvent', entityId, version);

    const canonical = {
        _id: entityId,
        actor: securityEvent.actor || '',
        actorRole: securityEvent.actorRole || '',
        action: securityEvent.action || securityEvent.eventType || '',
        targetType: securityEvent.targetType || '',
        targetId: String(securityEvent.targetId || ''),
        status: securityEvent.status || '',
        timestamp: securityEvent.createdAt instanceof Date ? securityEvent.createdAt.toISOString() : (securityEvent.createdAt || securityEvent.timestamp || new Date().toISOString()),
    };

    const dataHash = securityEvent.dataHash || fabricService.computeDataHash(canonical);

    return enqueueCommitment({
        commitmentId,
        eventType: 'SECURITY_EVENT',
        entityType: 'SecurityEvent',
        entityId,
        dataHash,
        previousCommitmentHash: previousHash,
        version,
    });
}

export async function enqueueExamCommitment(exam, version = 1, previousHash = '') {

    const entityId = exam._id.toString();
    const commitmentId = fabricService.buildCommitmentId('Exam', entityId, version);

    const canonical = {
        _id: entityId,
        title: exam.title,
        subject: exam.subject,
        mode: exam.mode,
        questionMerkleRoot: exam.questionMerkleRoot || '',
        durationMinutes: exam.durationMinutes,
        totalMarks: exam.totalMarks,
        scheduledAt: exam.scheduledAt instanceof Date ? exam.scheduledAt.toISOString() : exam.scheduledAt,
        createdAt: exam.createdAt instanceof Date ? exam.createdAt.toISOString() : exam.createdAt,
        questionCount: (exam.questions || []).length,
    };

    const dataHash = fabricService.computeDataHash(canonical);

    return enqueueCommitment({
        commitmentId,
        eventType: 'EXAM_COMMITMENT',
        entityType: 'Exam',
        entityId,
        dataHash,
        previousCommitmentHash: previousHash,
        version,
    });
}

export async function enqueueBatchCommitment(batch, version = 1, previousHash = '') {
    const entityId = batch._id.toString();
    const commitmentId = fabricService.buildCommitmentId('Batch', entityId, version);

    // The dataHash for a batch is simply its Merkle Root which encapsulates all questions
    return enqueueCommitment({
        commitmentId,
        eventType: 'BATCH_COMMITMENT',
        entityType: 'Batch',
        entityId,
        dataHash: batch.merkleRoot,
        previousCommitmentHash: previousHash,
        version,
    });
}

// ─── Reconciliation Sweeper (Option 2: Self-Healing Outbox) ─────────────────
let _reconcilerInterval = null;
const RECONCILE_INTERVAL_MS = 30 * 60 * 1000; // Run every 30 minutes

/**
 * Scans MongoDB for any committed/finalized entities that are missing an outbox
 * entry or need re-anchoring, guaranteeing At-Least-Once Delivery.
 */
export async function reconcileUncommittedEntities() {
    console.info('[RECONCILER] Starting integrity outbox reconciliation cycle...');
    const stats = {
        batchesReconciled: 0,
        resultsReconciled: 0,
        examsReconciled: 0,
        stuckProcessingReset: 0,
        permanentlyFailed: 0,
    };

    try {
        // 1. Reset any stale PROCESSING records whose lease expired
        const now = new Date();
        const resetResult = await IntegrityOutbox.updateMany(
            {
                status: 'PROCESSING',
                leaseExpiresAt: { $lt: now },
            },
            {
                $set: {
                    status: 'PENDING',
                    processingWorker: null,
                    leaseExpiresAt: null,
                },
            }
        );
        stats.stuckProcessingReset = resetResult.modifiedCount || 0;

        // 2. Audit FAILED outbox records: check if they are already confirmed on Fabric
        const failedRecords = await IntegrityOutbox.find({
            status: 'FAILED',
            entityType: { $ne: 'Question' }
        }).lean();

        let confirmedFromFabric = 0;
        let requeuedForRetry = 0;

        for (const failedRec of failedRecords) {
            try {
                const onChain = await fabricService.getCommitment(failedRec.commitmentId);
                if (onChain && onChain.id === failedRec.commitmentId) {
                    await IntegrityOutbox.updateOne(
                        { _id: failedRec._id },
                        {
                            $set: {
                                status: 'CONFIRMED',
                                fabricTxId: onChain.txId || null,
                                fabricBlockTimestamp: onChain.blockTimestamp || null,
                                fabricHeight: onChain.height || null,
                                lastError: null,
                                lastErrorCode: null,
                                confirmedAt: new Date(),
                                processingWorker: null,
                                leaseExpiresAt: null,
                            }
                        }
                    );
                    confirmedFromFabric++;
                } else {
                    await IntegrityOutbox.updateOne(
                        { _id: failedRec._id },
                        {
                            $set: {
                                status: 'PENDING',
                                attemptCount: 0,
                                lastError: null,
                                lastErrorCode: null,
                                processingWorker: null,
                                leaseExpiresAt: null,
                            }
                        }
                    );
                    requeuedForRetry++;
                }
            } catch (_) {
                await IntegrityOutbox.updateOne(
                    { _id: failedRec._id },
                    {
                        $set: {
                            status: 'PENDING',
                            attemptCount: 0,
                            lastError: null,
                            lastErrorCode: null,
                            processingWorker: null,
                            leaseExpiresAt: null,
                        }
                    }
                );
                requeuedForRetry++;
            }
        }
        stats.confirmedFromFabric = confirmedFromFabric;
        stats.requeuedForRetry = requeuedForRetry;
        stats.permanentlyFailed = await IntegrityOutbox.countDocuments({ status: 'FAILED' });

        // 3. Reconcile Accepted Batches
        const { Batch } = await import('../models/batch.models.js');
        const acceptedBatches = await Batch.find({
            status: 'Accepted',
            merkleRoot: { $exists: true, $ne: '' },
        }).select('_id merkleRoot title').lean();

        const existingBatchCommitments = new Set(
            (await IntegrityOutbox.find({ entityType: 'Batch' }).select('commitmentId').lean())
                .map(r => r.commitmentId)
        );

        for (const batch of acceptedBatches) {
            const commitmentId = fabricService.buildCommitmentId('Batch', batch._id.toString(), 1);
            if (!existingBatchCommitments.has(commitmentId)) {
                console.info(`[RECONCILER] Re-enqueuing missing batch commitment: ${batch._id} ("${batch.title}")`);
                await enqueueBatchCommitment(batch);
                existingBatchCommitments.add(commitmentId);
                stats.batchesReconciled++;
            }
        }

        // 4. Reconcile Completed Results (recent only to prevent queue starvation)
        const { Result } = await import('../models/result.models.js');
        const completedResults = await Result.find({ status: 'Completed' })
            .sort({ createdAt: -1 })
            .limit(25)
            .select('_id student exam score totalQuestions status isTerminated assignedQuestions createdAt')
            .lean();

        const existingResultCommitments = new Set(
            (await IntegrityOutbox.find({ entityType: 'Result' }).select('commitmentId').lean())
                .map(r => r.commitmentId)
        );

        for (const res of completedResults) {
            const commitmentId = fabricService.buildCommitmentId('Result', res._id.toString(), 1);
            if (!existingResultCommitments.has(commitmentId)) {
                console.info(`[RECONCILER] Re-enqueuing missing result commitment: ${res._id}`);
                await enqueueResultCommitment(res);
                existingResultCommitments.add(commitmentId);
                stats.resultsReconciled++;
            }
        }

        // 5. Reconcile Exams
        const { Exam } = await import('../models/exam.models.js');
        const exams = await Exam.find({})
            .select('_id title subject mode questionMerkleRoot durationMinutes totalMarks scheduledAt createdAt questions')
            .lean();

        const existingExamCommitments = new Set(
            (await IntegrityOutbox.find({ entityType: 'Exam' }).select('commitmentId').lean())
                .map(r => r.commitmentId)
        );

        for (const exam of exams) {
            const commitmentId = fabricService.buildCommitmentId('Exam', exam._id.toString(), 1);
            if (!existingExamCommitments.has(commitmentId)) {
                console.info(`[RECONCILER] Re-enqueuing missing exam commitment: ${exam._id} ("${exam.title}")`);
                await enqueueExamCommitment(exam, 1, '');
                existingExamCommitments.add(commitmentId);
                stats.examsReconciled++;
            }
        }

        console.info(`[RECONCILER] Cycle completed: batches=${stats.batchesReconciled}, results=${stats.resultsReconciled}, exams=${stats.examsReconciled}, resetStuck=${stats.stuckProcessingReset}, failed=${stats.permanentlyFailed}`);
    } catch (err) {
        console.error('[RECONCILER] Error during reconciliation:', err.message);
    }

    return stats;
}

/**
 * Starts the periodic reconciler background timer.
 */
export function startIntegrityReconciler() {
    if (_reconcilerInterval) return;

    console.info(`[RECONCILER] Initializing background reconciler (interval=${RECONCILE_INTERVAL_MS / 60000}m)`);

    // Run first reconciliation 5 seconds after startup
    setTimeout(() => {
        reconcileUncommittedEntities().catch(err =>
            console.error('[RECONCILER] Initial run error:', err.message)
        );
    }, 5000);

    _reconcilerInterval = setInterval(async () => {
        try {
            await reconcileUncommittedEntities();
        } catch (err) {
            console.error('[RECONCILER] Interval error:', err.message);
        }
    }, RECONCILE_INTERVAL_MS);
}

// ─── Recommit & Outbox Management Engine ────────────────────────────────────

let _recommitJob = {
    status: 'idle', // 'idle' | 'running' | 'completed' | 'failed' | 'stopped'
    mode: null,
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    startedAt: null,
    completedAt: null,
    currentCommitment: null,
    error: null,
    stopRequested: false,
};

export function getRecommitJobStatus() {
    return { ..._recommitJob };
}

export function stopRecommitJob() {
    if (_recommitJob && _recommitJob.status === 'running') {
        _recommitJob.stopRequested = true;
        return { message: 'Recommit job stop requested.', job: getRecommitJobStatus() };
    }
    return { message: 'No recommit job currently running.', job: getRecommitJobStatus() };
}

export async function getOutboxStats() {
    const counts = await IntegrityOutbox.aggregate([
        {
            $group: {
                _id: {
                    status: '$status',
                    entityType: '$entityType',
                },
                count: { $sum: 1 },
            },
        },
    ]);

    const stats = {
        total: 0,
        confirmed: 0,
        pending: 0,
        processing: 0,
        failed: 0,
        byType: {
            Batch: 0,
            Exam: 0,
            Result: 0,
            SecurityEvent: 0,
            Question: 0,
        },
        recommitJob: getRecommitJobStatus(),
    };

    for (const item of counts) {
        const { status, entityType } = item._id || {};
        const c = item.count || 0;
        if (entityType !== 'Question') {
            stats.total += c;
            if (status === 'CONFIRMED') stats.confirmed += c;
            else if (status === 'PENDING') stats.pending += c;
            else if (status === 'PROCESSING') stats.processing += c;
            else if (status === 'FAILED') stats.failed += c;
        }
        if (entityType && stats.byType[entityType] !== undefined) {
            stats.byType[entityType] += c;
        }
    }

    return stats;
}

export async function startRecommitJob({ mode = 'all', resetDb = true } = {}) {
    if (_recommitJob && _recommitJob.status === 'running') {
        const err = new Error('A recommit job is already running.');
        err.code = 'JOB_ALREADY_RUNNING';
        throw err;
    }

    // Ensure Fabric connection
    try {
        await fabricService.forceReconnect();
    } catch (connErr) {
        console.warn('[RECOMMIT] Fabric reconnect warning:', connErr.message);
    }

    const fabricStatus = await fabricService.getFabricStatus();
    if (!fabricStatus.enabled) {
        const err = new Error('Fabric integration is disabled (FABRIC_ENABLED=false). Cannot recommit.');
        err.code = 'FABRIC_DISABLED';
        throw err;
    }
    if (!fabricStatus.connected) {
        const err = new Error(`Fabric peer is not connected (${fabricStatus.error || 'Network offline'}). Ensure network is running.`);
        err.code = 'FABRIC_NOT_CONNECTED';
        throw err;
    }

    // Reconcile entities from MongoDB first to make sure outbox has everything
    try {
        await reconcileUncommittedEntities();
    } catch (recErr) {
        console.warn('[RECOMMIT] Pre-reconciliation warning:', recErr.message);
    }

    // Reset database status if requested
    if (resetDb) {
        const resetFields = {
            status: 'PENDING',
            attemptCount: 0,
            fabricTxId: null,
            fabricHeight: null,
            fabricBlockTimestamp: null,
            confirmedAt: null,
            lastError: null,
            lastErrorCode: null,
            processingWorker: null,
            leaseExpiresAt: null,
        };

        if (mode === 'all') {
            await IntegrityOutbox.updateMany(
                { entityType: { $ne: 'Question' } },
                { $set: resetFields }
            );
        } else if (mode === 'core') {
            // Reset all structural commitments (Batch, Exam, SecurityEvent)
            await IntegrityOutbox.updateMany(
                { entityType: { $in: ['Batch', 'Exam', 'SecurityEvent'] } },
                { $set: resetFields }
            );

            // Reset only recent 100 results so they commit fast
            const recentResults = await IntegrityOutbox.find({ entityType: 'Result' })
                .sort({ createdAt: -1 })
                .limit(100)
                .select('_id')
                .lean();

            if (recentResults.length > 0) {
                const ids = recentResults.map(r => r._id);
                await IntegrityOutbox.updateMany(
                    { _id: { $in: ids } },
                    { $set: resetFields }
                );
            }
        } else if (mode === 'pending') {
            // Reset any failed or stuck processing records
            await IntegrityOutbox.updateMany(
                {
                    status: { $in: ['PROCESSING', 'FAILED'] },
                    entityType: { $ne: 'Question' },
                },
                { $set: resetFields }
            );
        }
    }

    // Find all records to commit
    const pendingRecords = await IntegrityOutbox.find({
        status: 'PENDING',
        entityType: { $ne: 'Question' },
    }).lean();

    // Priority ordering: Batch -> Exam -> SecurityEvent -> Result (oldest to newest)
    const priorityMap = { Batch: 1, Exam: 2, SecurityEvent: 3, Result: 4 };
    pendingRecords.sort((a, b) => {
        const pA = priorityMap[a.entityType] || 5;
        const pB = priorityMap[b.entityType] || 5;
        if (pA !== pB) return pA - pB;
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });

    _recommitJob = {
        status: 'running',
        mode,
        total: pendingRecords.length,
        processed: 0,
        succeeded: 0,
        failed: 0,
        startedAt: new Date().toISOString(),
        completedAt: null,
        currentCommitment: null,
        error: null,
        stopRequested: false,
    };

    console.info(`[RECOMMIT] Starting recommit job (mode=${mode}, total=${pendingRecords.length})`);

    // Run async in background
    (async () => {
        const RUNNER_ID = `RECOMMIT-${Date.now()}`;
        for (const rec of pendingRecords) {
            if (_recommitJob.stopRequested) {
                console.info('[RECOMMIT] Stop requested. Halting recommit job.');
                _recommitJob.status = 'stopped';
                _recommitJob.completedAt = new Date().toISOString();
                _recommitJob.currentCommitment = null;
                break;
            }

            _recommitJob.currentCommitment = {
                id: rec.commitmentId,
                entityType: rec.entityType,
                count: _recommitJob.processed + 1,
            };

            try {
                // Claim record
                await IntegrityOutbox.updateOne({ _id: rec._id }, {
                    $set: {
                        status: 'PROCESSING',
                        processingWorker: RUNNER_ID,
                        leaseExpiresAt: new Date(Date.now() + 60000),
                    },
                });

                const res = await fabricService.createCommitment({
                    id: rec.commitmentId,
                    eventType: rec.eventType,
                    entityType: rec.entityType,
                    entityId: rec.entityId,
                    dataHash: rec.dataHash,
                    previousCommitmentHash: rec.previousCommitmentHash || '',
                    version: rec.version || 1,
                    timestamp: rec.eventTimestamp,
                });

                await IntegrityOutbox.updateOne({ _id: rec._id }, {
                    $set: {
                        status: 'CONFIRMED',
                        fabricTxId: res.txId || null,
                        fabricBlockTimestamp: res.blockTimestamp || null,
                        fabricHeight: res.height || null,
                        lastError: null,
                        lastErrorCode: null,
                        confirmedAt: new Date(),
                        processingWorker: null,
                        leaseExpiresAt: null,
                    },
                });

                _recommitJob.succeeded++;
            } catch (err) {
                const errMsg = err?.message || String(err);
                console.error(`[RECOMMIT] Failed commitment ${rec.commitmentId}:`, errMsg);

                await IntegrityOutbox.updateOne({ _id: rec._id }, {
                    $set: {
                        status: 'FAILED',
                        lastError: errMsg.substring(0, 500),
                        lastErrorCode: err?.code || 'UNKNOWN',
                        processingWorker: null,
                        leaseExpiresAt: null,
                    },
                });

                _recommitJob.failed++;
            } finally {
                _recommitJob.processed++;
                // Pace transactions to allow Raft ordering to cut blocks without concurrency conflict
                await new Promise(r => setTimeout(r, 200));
            }
        }

        if (_recommitJob.status === 'running') {
            _recommitJob.status = 'completed';
            _recommitJob.completedAt = new Date().toISOString();
            _recommitJob.currentCommitment = null;
            console.info(`[RECOMMIT] Recommit job completed: ${_recommitJob.succeeded} succeeded, ${_recommitJob.failed} failed.`);
        }
    })().catch(unhandledErr => {
        console.error('[RECOMMIT] Fatal unhandled error in recommit loop:', unhandledErr.message);
        _recommitJob.status = 'failed';
        _recommitJob.error = unhandledErr.message;
        _recommitJob.completedAt = new Date().toISOString();
    });

    return {
        message: 'Recommit job initiated successfully.',
        job: getRecommitJobStatus(),
    };
}

