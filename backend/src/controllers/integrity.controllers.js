import * as verificationService from '../Services/integrityVerification.service.js';
import * as fabricService from '../Services/fabric.service.js';
import * as outboxService from '../Services/integrityOutbox.service.js';
import { IntegrityOutbox } from '../models/integrityOutbox.models.js';
import { Notification } from '../models/notification.models.js';
import { AuditLog } from '../models/auditlog.models.js';
import { Admin } from '../models/admin.models.js';
import { Auditor } from '../models/auditor.models.js';

export const getFabricStatus = async (req, res) => {
    try {
        const status = await fabricService.getFabricStatus();
        return res.status(200).json(status);
    } catch (err) {
        console.error('[INTEGRITY] Error fetching Fabric status:', err.message);
        return res.status(500).json({ message: 'Failed to retrieve Fabric status.', error: err.message });
    }
};

export const verifyResult = async (req, res) => {
    try {
        const { resultId } = req.params;
        if (!_isValidObjectId(resultId)) {
            return res.status(400).json({ message: 'Invalid resultId format.' });
        }

        const result = await verificationService.verifyResult(resultId);
        return res.status(200).json(result);
    } catch (err) {
        console.error('[INTEGRITY] Error verifying result:', err.message);
        return res.status(500).json({ message: 'Integrity verification failed.', error: err.message });
    }
};

export const verifyBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        if (!_isValidObjectId(batchId)) {
            return res.status(400).json({ message: 'Invalid batchId format.' });
        }

        const result = await verificationService.verifyBatch(batchId);
        return res.status(200).json(result);
    } catch (err) {
        console.error('[INTEGRITY] Error verifying batch:', err.message);
        return res.status(500).json({ message: 'Integrity verification failed.', error: err.message });
    }
};

export const verifyExam = async (req, res) => {
    try {
        const { examId } = req.params;
        if (!_isValidObjectId(examId)) {
            return res.status(400).json({ message: 'Invalid examId format.' });
        }

        const result = await verificationService.verifyExam(examId);
        return res.status(200).json(result);
    } catch (err) {
        console.error('[INTEGRITY] Error verifying exam:', err.message);
        return res.status(500).json({ message: 'Integrity verification failed.', error: err.message });
    }
};

export const verifySecurityEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        if (!_isValidObjectId(eventId)) {
            return res.status(400).json({ message: 'Invalid eventId format.' });
        }

        const result = await verificationService.verifySecurityEvent(eventId);
        return res.status(200).json(result);
    } catch (err) {
        console.error('[INTEGRITY] Error verifying security event:', err.message);
        return res.status(500).json({ message: 'Integrity verification failed.', error: err.message });
    }
};

export const getCommitment = async (req, res) => {
    try {
        const { commitmentId } = req.params;
        const commitment = await fabricService.getCommitment(commitmentId);
        return res.status(200).json(commitment);
    } catch (err) {
        if (err.code === 'FABRIC_DISABLED') {
            return res.status(503).json({ message: 'Fabric integration is disabled.', code: 'FABRIC_DISABLED' });
        }
        if (err.code === 'COMMITMENT_NOT_FOUND') {
            return res.status(404).json({ message: `Commitment not found: ${req.params.commitmentId}`, code: 'COMMITMENT_NOT_FOUND' });
        }
        console.error('[INTEGRITY] Error fetching commitment:', err.message);
        return res.status(500).json({ message: 'Failed to fetch commitment.', error: err.message });
    }
};

export const getCommitmentHistory = async (req, res) => {
    try {
        const { commitmentId } = req.params;
        const history = await fabricService.getCommitmentHistory(commitmentId);
        return res.status(200).json({ history });
    } catch (err) {
        if (err.code === 'FABRIC_DISABLED') {
            return res.status(503).json({ message: 'Fabric integration is disabled.', code: 'FABRIC_DISABLED' });
        }
        console.error('[INTEGRITY] Error fetching commitment history:', err.message);
        return res.status(500).json({ message: 'Failed to fetch commitment history.', error: err.message });
    }
};

export const getRecentCommitments = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
        const commitments = await fabricService.getRecentCommitments(limit);
        const outboxConfirmed = await IntegrityOutbox.countDocuments({
            status: 'CONFIRMED',
            entityType: { $ne: 'Question' }
        });
        const outboxTotal = await IntegrityOutbox.countDocuments({
            entityType: { $ne: 'Question' }
        });
        const heightData = await fabricService.getLedgerHeight().catch(() => ({ height: 0 }));
        const actualTotal = Math.max(heightData?.height || 0, outboxConfirmed, outboxTotal, commitments.length);

        return res.status(200).json({
            commitments,
            totalCommitments: actualTotal,
            total: actualTotal,
            ledgerHeight: heightData?.height || 0,
        });
    } catch (err) {
        if (err.code === 'FABRIC_DISABLED') {
            const outboxConfirmed = await IntegrityOutbox.countDocuments({
                status: 'CONFIRMED',
                entityType: { $ne: 'Question' }
            }).catch(() => 0);
            return res.status(200).json({ commitments: [], totalCommitments: outboxConfirmed, total: outboxConfirmed, fabricEnabled: false });
        }
        console.error('[INTEGRITY] Error fetching recent commitments:', err.message);
        return res.status(500).json({ message: 'Failed to fetch recent commitments.', error: err.message });
    }
};

export const getOutboxStatus = async (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        const validTypes = ['Result', 'Batch', 'Exam', 'SecurityEvent'];
        if (!validTypes.includes(entityType)) {
            return res.status(400).json({ message: `Invalid entityType. Must be one of: ${validTypes.join(', ')}` });
        }
        if (!_isValidObjectId(entityId)) {
            return res.status(400).json({ message: 'Invalid entityId format.' });
        }

        const records = await verificationService.getOutboxStatus(entityType, entityId);
        return res.status(200).json({ outbox: records });
    } catch (err) {
        console.error('[INTEGRITY] Error fetching outbox status:', err.message);
        return res.status(500).json({ message: 'Failed to fetch outbox status.', error: err.message });
    }
};

export const getPendingOutbox = async (req, res) => {
    try {
        const records = await IntegrityOutbox.find({
            status: { $in: ['PENDING', 'PROCESSING', 'FAILED'] },
        })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        return res.status(200).json({ records });
    } catch (err) {
        console.error('[INTEGRITY] Error fetching pending outbox:', err.message);
        return res.status(500).json({ message: 'Failed to fetch pending outbox records.', error: err.message });
    }
};

export const getLedgerHeight = async (req, res) => {
    try {
        const result = await fabricService.getLedgerHeight();
        const outboxConfirmed = await IntegrityOutbox.countDocuments({
            status: 'CONFIRMED',
            entityType: { $ne: 'Question' }
        });
        const outboxTotal = await IntegrityOutbox.countDocuments({
            entityType: { $ne: 'Question' }
        });
        const actualTotal = Math.max(result?.height || 0, outboxConfirmed, outboxTotal);

        return res.status(200).json({
            ...result,
            totalCommitments: actualTotal,
            outboxConfirmed,
            outboxTotal,
        });
    } catch (err) {
        if (err.code === 'FABRIC_DISABLED') {
            const outboxConfirmed = await IntegrityOutbox.countDocuments({
                status: 'CONFIRMED',
                entityType: { $ne: 'Question' }
            }).catch(() => 0);
            return res.status(200).json({ height: 0, totalCommitments: outboxConfirmed, fabricEnabled: false });
        }
        console.error('[INTEGRITY] Error fetching ledger height:', err.message);
        return res.status(500).json({ message: 'Failed to fetch ledger height.', error: err.message });
    }
};

export const getFabricBlocks = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || '500', 10), 1000);
        const data = await fabricService.getFabricBlocks(limit);
        return res.status(200).json(data);
    } catch (err) {
        if (err.code === 'FABRIC_DISABLED') {
            return res.status(200).json({ blocks: [], height: 0, fabricEnabled: false });
        }
        console.error('[INTEGRITY] Error fetching fabric blocks:', err.message);
        return res.status(500).json({ message: 'Failed to fetch fabric blocks.', error: err.message });
    }
};

function _isValidObjectId(id) {
    return /^[a-f0-9]{24}$/.test(id);
}

// ─── GET /api/integrity/alerts ───────────────────────────────────────────────
export const getIntegrityAlerts = async (req, res) => {
    try {
        const userId = req.admin?._id || req.auditor?._id;
        const userRole = req.admin ? 'Admin' : 'Auditor';

        // Query for tampering notifications matching this user, role, or title
        const alerts = await Notification.find({
            $or: [
                { userId, title: '⚠️ DB TAMPERING DETECTED' },
                { userRole, title: '⚠️ DB TAMPERING DETECTED' },
                { title: '⚠️ DB TAMPERING DETECTED' }
            ]
        }).sort({ createdAt: -1 }).limit(100).lean();

        // Fetch staff maps to resolve recipient emails and names
        const [admins, auditors] = await Promise.all([
            Admin.find({}).select('_id name email').lean(),
            Auditor.find({}).select('_id name email').lean()
        ]);
        const userMap = new Map();
        admins.forEach(a => userMap.set(a._id.toString(), { name: a.name || 'System Admin', email: a.email, role: 'Admin' }));
        auditors.forEach(a => userMap.set(a._id.toString(), { name: a.name || 'Auditor', email: a.email, role: 'Auditor' }));

        const enrichedDeliveries = alerts.map(a => {
            const user = userMap.get(a.userId?.toString()) || { name: 'Staff Member', email: 'Unknown', role: a.userRole };
            return {
                ...a,
                recipientName: user.name,
                recipientEmail: user.email,
                recipientRole: user.role
            };
        });

        // Group into unique incidents by message & incident time bucket (10s)
        const incidentMap = new Map();
        for (const d of enrichedDeliveries) {
            const timeBucket = Math.floor(new Date(d.createdAt).getTime() / 10000);
            const key = `${d.message}-${timeBucket}`;
            if (!incidentMap.has(key)) {
                incidentMap.set(key, {
                    ...d,
                    recipients: [],
                    deliveryCount: 0
                });
            }
            const incident = incidentMap.get(key);
            incident.recipients.push({
                _id: d._id,
                userId: d.userId,
                name: d.recipientName,
                email: d.recipientEmail,
                role: d.recipientRole,
                isRead: d.isRead
            });
            incident.deliveryCount = incident.recipients.length;
        }

        const uniqueAlerts = Array.from(incidentMap.values()).map(inc => {
            const isAcknowledged = inc.recipients.length > 0 && inc.recipients.some(r => r.isRead);
            return {
                ...inc,
                isAcknowledged
            };
        });

        const activeIncidents = uniqueAlerts.filter(a => !a.isAcknowledged).length;

        res.json({
            alerts: uniqueAlerts,
            deliveries: enrichedDeliveries,
            totalIncidents: uniqueAlerts.length,
            activeIncidents,
            totalDeliveries: enrichedDeliveries.length
        });
    } catch (e) {
        console.error("[INTEGRITY] Error getting alerts:", e.message);
        res.status(500).json({ message: "Failed to fetch integrity alerts" });
    }
};

// ─── POST /api/integrity/alerts/dismiss ──────────────────────────────────────
export const dismissIntegrityAlerts = async (req, res) => {
    try {
        const { deliveryIds, dismissAll } = req.body || {};

        let filter = { title: '⚠️ DB TAMPERING DETECTED' };
        if (!dismissAll && Array.isArray(deliveryIds) && deliveryIds.length > 0) {
            filter = { _id: { $in: deliveryIds } };
        }

        const result = await Notification.updateMany(filter, { $set: { isRead: true } });

        try {
            const { AuditLog } = await import('../models/auditlog.models.js');
            await AuditLog.create({
                actor: req.admin?.name || req.auditor?.name || "Admin",
                actorRole: req.admin ? "Admin" : "Auditor",
                action: "TAMPER_ALERTS_ACKNOWLEDGED",
                targetType: "IntegrityAlert",
                details: dismissAll
                    ? "All tamper breach alerts acknowledged"
                    : `Tamper incident (${deliveryIds?.length || 0} deliveries) acknowledged`,
                status: "success"
            });
        } catch (_) { }

        res.json({
            success: true,
            message: "Tamper alert(s) acknowledged successfully",
            modifiedCount: result.modifiedCount
        });
    } catch (e) {
        console.error("[INTEGRITY] Error dismissing alerts:", e.message);
        res.status(500).json({ message: "Failed to dismiss integrity alerts" });
    }
};

// ─── DELETE /api/integrity/alerts ─────────────────────────────────────────────
export const clearIntegrityAlerts = async (req, res) => {
    try {
        const { deliveryIds, clearAll } = req.body || {};

        let filter = { title: '⚠️ DB TAMPERING DETECTED' };
        if (!clearAll && Array.isArray(deliveryIds) && deliveryIds.length > 0) {
            filter = { _id: { $in: deliveryIds } };
        }

        const result = await Notification.deleteMany(filter);

        try {
            const { AuditLog } = await import('../models/auditlog.models.js');
            await AuditLog.create({
                actor: req.admin?.name || req.auditor?.name || "Admin",
                actorRole: req.admin ? "Admin" : "Auditor",
                action: "TAMPER_ALERTS_CLEARED",
                targetType: "IntegrityAlert",
                details: clearAll
                    ? "All tamper breach alerts permanently cleared from database"
                    : `Tamper incident (${deliveryIds?.length || 0} deliveries) cleared from logs`,
                status: "success"
            });
        } catch (_) { }

        res.json({
            success: true,
            message: "Tamper alert log(s) cleared successfully",
            deletedCount: result.deletedCount
        });
    } catch (e) {
        console.error("[INTEGRITY] Error clearing alerts:", e.message);
        res.status(500).json({ message: "Failed to clear integrity alerts" });
    }
};

// ─── POST /api/integrity/verify-ledger ───────────────────────────────────────
// Bulk verification: fetches all CONFIRMED outbox records and re-verifies each
// entity's recomputed MongoDB hash against the immutable Fabric commitment.
// Supports both standard JSON responses and real-time SSE streaming (?stream=true).
export const verifyAllCommitments = async (req, res) => {
    const isStream = req.query.stream === 'true' || req.headers.accept?.includes('text/event-stream');

    if (isStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();
    }

    const sendEvent = (data) => {
        if (isStream) {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    };

    let aborted = false;
    req.on('close', () => {
        aborted = true;
    });

    try {
        // Fetch all confirmed commitments from the outbox (strictly excluding legacy mock transactions)
        const confirmedRecords = await IntegrityOutbox.find({
            status: 'CONFIRMED',
            privateTransactionId: { $exists: false },
            commitmentId: { $exists: true, $ne: null }
        })
            .sort({ createdAt: -1 })
            .limit(500)
            .lean();

        // When multiple versions exist for the same entity, verify the latest version against live data
        const latestByEntity = new Map();
        for (const record of confirmedRecords) {
            const key = `${record.entityType}:${record.entityId}`;
            const existing = latestByEntity.get(key);
            if (!existing || (record.version || 1) > (existing.version || 1)) {
                latestByEntity.set(key, record);
            }
        }
        const activeRecords = Array.from(latestByEntity.values());

        sendEvent({
            type: 'init',
            total: activeRecords.length,
            message: `Found ${activeRecords.length} commitments to verify`,
        });

        if (activeRecords.length === 0) {
            const emptyDone = {
                fabricEnabled: true,
                summary: { total: 0, verified: 0, tampered: 0, skipped: 0 },
                results: [],
                verifiedAt: new Date().toISOString(),
            };
            if (isStream) {
                sendEvent({ type: 'done', ...emptyDone });
                return res.end();
            }
            return res.status(200).json(emptyDone);
        }

        const results = [];
        let verified = 0;
        let tampered = 0;
        let skipped = 0;
        let processed = 0;

        for (const record of activeRecords) {
            if (aborted) break;

            const { entityType, entityId, commitmentId, version } = record;
            let verResult = null;

            try {
                if (entityType === 'Result') {
                    verResult = await verificationService.verifyResult(entityId, version);
                } else if (entityType === 'Exam') {
                    verResult = await verificationService.verifyExam(entityId, version);
                } else if (entityType === 'Batch') {
                    verResult = await verificationService.verifyBatch(entityId, version);
                } else if (entityType === 'SecurityEvent') {
                    verResult = await verificationService.verifySecurityEvent(entityId);
                } else {
                    skipped++;
                    processed++;
                    const skippedItem = {
                        commitmentId,
                        entityType,
                        entityId,
                        status: 'SKIPPED',
                        reason: 'UNSUPPORTED_ENTITY_TYPE',
                        message: `Verification not supported for entity type: ${entityType}`,
                    };
                    results.push(skippedItem);

                    sendEvent({
                        type: 'progress',
                        total: activeRecords.length,
                        processed,
                        percent: Math.min(100, Math.round((processed / activeRecords.length) * 100)),
                        entityType,
                        entityId,
                        status: 'SKIPPED',
                        summary: {
                            total: activeRecords.length,
                            processed,
                            verified,
                            tampered,
                            skipped,
                        }
                    });
                    continue;
                }

                const isTampered = verResult?.valid === false && verResult?.reason === 'HASH_MISMATCH';
                const isVerified = verResult?.valid === true;

                if (isVerified) verified++;
                else if (isTampered) {
                    tampered++;
                    try {
                        await AuditLog.create({
                            actor: req.admin?.email || req.auditor?.email || "System",
                            actorRole: req.admin ? "Admin" : req.auditor ? "Auditor" : "System",
                            action: "LEDGER_TAMPERING_DETECTED",
                            targetType: entityType,
                            targetId: String(entityId),
                            targetLabel: commitmentId,
                            details: `Ledger verification failed: hash mismatch on ${entityType} (${entityId}). Live hash: ${verResult?.computedHash}, Ledger: ${verResult?.ledgerHash}`,
                            status: "failure"
                        });
                    } catch (logErr) {
                        console.error("[INTEGRITY] Failed to write AuditLog for tampering:", logErr.message);
                    }
                } else skipped++;

                processed++;

                results.push({
                    commitmentId,
                    entityType,
                    entityId,
                    fabricTxId: record.fabricTxId,
                    fabricBlockTimestamp: record.fabricBlockTimestamp,
                    status: isVerified ? 'VERIFIED' : isTampered ? 'TAMPERED' : 'UNVERIFIABLE',
                    reason: verResult?.reason,
                    computedHash: verResult?.computedHash,
                    ledgerHash: verResult?.ledgerHash,
                    message: verResult?.message,
                    verifiedAt: verResult?.verifiedAt,
                });

                sendEvent({
                    type: 'progress',
                    total: activeRecords.length,
                    processed,
                    percent: Math.min(100, Math.round((processed / activeRecords.length) * 100)),
                    entityType,
                    entityId,
                    status: isVerified ? 'VERIFIED' : isTampered ? 'TAMPERED' : 'UNVERIFIABLE',
                    summary: {
                        total: activeRecords.length,
                        processed,
                        verified,
                        tampered,
                        skipped,
                    }
                });
            } catch (err) {
                skipped++;
                processed++;
                results.push({
                    commitmentId,
                    entityType,
                    entityId,
                    status: 'ERROR',
                    reason: 'VERIFICATION_EXCEPTION',
                    message: err.message,
                });

                sendEvent({
                    type: 'progress',
                    total: activeRecords.length,
                    processed,
                    percent: Math.min(100, Math.round((processed / activeRecords.length) * 100)),
                    entityType,
                    entityId,
                    status: 'ERROR',
                    summary: {
                        total: activeRecords.length,
                        processed,
                        verified,
                        tampered,
                        skipped,
                    }
                });
            }
        }

        const finalPayload = {
            fabricEnabled: true,
            summary: {
                total: activeRecords.length,
                confirmedCommitmentsCount: confirmedRecords.length,
                verified,
                tampered,
                skipped,
            },
            results,
            verifiedAt: new Date().toISOString(),
        };

        if (isStream) {
            sendEvent({
                type: 'done',
                ...finalPayload,
            });
            return res.end();
        }

        return res.status(200).json(finalPayload);
    } catch (e) {
        console.error('[INTEGRITY] Error running bulk ledger verification:', e.message);
        if (isStream) {
            sendEvent({
                type: 'error',
                message: e.message || 'Bulk ledger verification failed.',
            });
            return res.end();
        }
        return res.status(500).json({ message: 'Bulk ledger verification failed.', error: e.message });
    }
};

// ─── POST /api/integrity/reconcile ───────────────────────────────────────────
// Manually triggers a self-healing reconciliation cycle to discover and enqueue
// any uncommitted or missing database records into the IntegrityOutbox.
export const triggerReconciliation = async (req, res) => {
    try {
        const { reconcileUncommittedEntities } = await import('../Services/integrityOutbox.service.js');
        const stats = await reconcileUncommittedEntities();
        return res.status(200).json({
            message: 'Integrity outbox reconciliation completed successfully.',
            stats,
            reconciledAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[INTEGRITY] Error triggering reconciliation:', err.message);
        return res.status(500).json({ message: 'Failed to run reconciliation.', error: err.message });
    }
};

// ─── Outbox Stats & Recommit Controllers ────────────────────────────────────

export const getOutboxStats = async (req, res) => {
    try {
        const stats = await outboxService.getOutboxStats();
        const heightData = await fabricService.getLedgerHeight().catch(() => ({ height: 0 }));
        const fabricStatus = await fabricService.getFabricStatus().catch(() => ({ connected: false }));

        return res.status(200).json({
            ...stats,
            ledgerHeight: heightData?.height ?? 0,
            fabricConnected: fabricStatus?.connected ?? false,
            fabricEnabled: fabricStatus?.enabled ?? false,
        });
    } catch (err) {
        console.error('[INTEGRITY] Error fetching outbox stats:', err.message);
        return res.status(500).json({ message: 'Failed to fetch outbox stats.', error: err.message });
    }
};

export const startRecommit = async (req, res) => {
    try {
        const { mode = 'all', resetDb = true } = req.body || {};
        const result = await outboxService.startRecommitJob({ mode, resetDb });
        return res.status(200).json(result);
    } catch (err) {
        console.error('[INTEGRITY] Error starting recommit job:', err.message);
        const status = err.code === 'JOB_ALREADY_RUNNING' ? 409 : 500;
        return res.status(status).json({ message: err.message, code: err.code || 'RECOMMIT_ERROR' });
    }
};

export const getRecommitStatus = async (req, res) => {
    try {
        const job = outboxService.getRecommitJobStatus();
        const heightData = await fabricService.getLedgerHeight().catch(() => ({ height: 0 }));
        return res.status(200).json({
            job,
            ledgerHeight: heightData?.height ?? 0,
        });
    } catch (err) {
        console.error('[INTEGRITY] Error fetching recommit status:', err.message);
        return res.status(500).json({ message: 'Failed to fetch recommit status.', error: err.message });
    }
};

export const stopRecommit = async (req, res) => {
    try {
        const result = outboxService.stopRecommitJob();
        return res.status(200).json(result);
    } catch (err) {
        console.error('[INTEGRITY] Error stopping recommit job:', err.message);
        return res.status(500).json({ message: 'Failed to stop recommit job.', error: err.message });
    }
};

export const reconnectFabric = async (req, res) => {
    try {
        const status = await fabricService.forceReconnect();
        return res.status(200).json({ message: 'Fabric gateway reconnected.', status });
    } catch (err) {
        console.error('[INTEGRITY] Error reconnecting to Fabric:', err.message);
        return res.status(500).json({ message: 'Failed to reconnect to Fabric.', error: err.message });
    }
};
