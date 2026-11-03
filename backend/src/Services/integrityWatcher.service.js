import { Result } from '../models/result.models.js';
import { Exam } from '../models/exam.models.js';
import { Batch } from '../models/batch.models.js';
import { Admin } from '../models/admin.models.js';
import { Auditor } from '../models/auditor.models.js';
import { Notification } from '../models/notification.models.js';
import { AuditLog } from '../models/auditlog.models.js';
import { IntegrityOutbox } from '../models/integrityOutbox.models.js';
import { verifyResult, verifyExam, verifyBatch } from './integrityVerification.service.js';

let watchers = [];

export function startIntegrityWatcher() {
    try {
        const watchOptions = { fullDocument: 'updateLookup' };

        // Watch Results
        const resultStream = Result.watch([], watchOptions);
        resultStream.on('change', async (change) => {
            const id = change.documentKey._id.toString();
            console.log(`[WATCHER] ChangeStream event detected on Result: ${id}, type: ${change.operationType}`);
            if (['update', 'replace'].includes(change.operationType)) {
                await checkIntegrity('Result', id, verifyResult);
            }
        });

        // Watch Exams
        const examStream = Exam.watch([], watchOptions);
        examStream.on('change', async (change) => {
            const id = change.documentKey._id.toString();
            if (['update', 'replace'].includes(change.operationType)) {
                await checkIntegrity('Exam', id, verifyExam);
            }
        });

        // Watch Batches
        const batchStream = Batch.watch([], watchOptions);
        batchStream.on('change', async (change) => {
            const id = change.documentKey._id.toString();
            if (['update', 'replace'].includes(change.operationType)) {
                await checkIntegrity('Batch', id, verifyBatch);
            }
        });

        watchers.push(resultStream, examStream, batchStream);
        console.log("[WATCHER] Integrity Change Streams initialized.");
    } catch (e) {
        console.error("[WATCHER] Failed to start change streams. MongoDB replica set is required.", e.message);
    }
}

async function checkIntegrity(type, id, verifyFn) {
    try {
        // Add a small delay to ensure any synchronous DB operations complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const result = await verifyFn(id);
        console.log(`[WATCHER] Verified ${type} ${id}. Valid: ${result?.valid}, Reason: ${result?.reason}`);
        
        if (result && result.valid === false && (result.reason === 'HASH_MISMATCH' || result.reason === 'NO_MERKLE_ROOT')) {
            // Check if there is a legitimate update pending in the Outbox
            const pendingOutbox = await IntegrityOutbox.findOne({
                entityId: id,
                status: { $in: ['PENDING', 'PROCESSING'] }
            }).lean();
            
            if (pendingOutbox) {
                console.log(`[WATCHER] Ignored tampering on ${type} ${id} because there is a pending legitimate outbox update.`);
                // Legitimate system update is in transit to the ledger.
                return;
            }
            
            console.warn(`[INTEGRITY BREACH] Automatically detected tampering on ${type} ${id}!`);
            await alertAdmins(type, id, result);
        }
    } catch (error) {
        console.error(`[WATCHER] Error verifying ${type} ${id}:`, error.message);
    }
}

async function alertAdmins(type, id, verificationResult) {
    const message = `BLOCKCHAIN INTEGRITY BREACH: Unauthorized modification detected in ${type} database record (${id}). The computed hash no longer matches the immutable ledger commitment!`;
    
    // Check if we recently alerted for this specific entity to avoid spamming
    const recentAlert = await Notification.findOne({
        title: `⚠️ DB TAMPERING DETECTED`,
        message: message,
        createdAt: { $gte: new Date(Date.now() - 60000) } // within last 1 min
    }).lean();
    
    if (recentAlert) return;

    const admins = await Admin.find({}).select('_id').lean();
    const auditors = await Auditor.find({}).select('_id').lean();
    
    const notifications = [];
    
    for (const a of admins) {
        notifications.push({
            userId: a._id,
            userRole: "Admin",
            title: `⚠️ DB TAMPERING DETECTED`,
            message: message,
            type: "ERROR",
            relatedLink: `/admin/blockchain`
        });
    }
    for (const a of auditors) {
        notifications.push({
            userId: a._id,
            userRole: "Auditor",
            title: `⚠️ DB TAMPERING DETECTED`,
            message: message,
            type: "ERROR",
            relatedLink: `/auditor/blockchain`
        });
    }
    
    if (notifications.length > 0) {
        await Notification.insertMany(notifications);
    }

    try {
        const log = await AuditLog.create({
            actor: "System",
            actorRole: "System",
            action: "LEDGER_TAMPERING_DETECTED",
            targetType: type,
            targetId: String(id),
            targetLabel: `${type} ${id}`,
            details: `Unauthorized database modification caught by change stream. Live hash differs from ledger commitment.`,
            status: "failure"
        });
        try {
            const { enqueueSecurityEventCommitment } = await import('./integrityOutbox.service.js');
            await enqueueSecurityEventCommitment(log);
        } catch (secErr) {
            console.error('[WATCHER] Failed to enqueue security event commitment:', secErr.message);
        }
    } catch (auditErr) {
        console.error("[WATCHER] Failed to write AuditLog for tampering:", auditErr.message);
    }
}
