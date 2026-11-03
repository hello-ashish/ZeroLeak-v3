// =============================================================================
// ZeroLeak — integrity.routes.js
// =============================================================================
// Routes for Fabric integrity verification.
//
// Authorization:
//   - Admin (isSupport=false): full access via verifyAdminJWT
//   - Auditor: full access via verifyAuditorJWT
//   - Support: BLOCKED (verifyAdminJWT rejects support accounts)
//   - Professor/Student: NO access (not mounted on their routers)
//
// Fabric status is public within the admin/auditor context (no additional
// authorization needed beyond the existing JWT middlewares).
// =============================================================================

import { Router } from 'express';
import {
    getFabricStatus,
    verifyResult,
    verifyBatch,
    verifyExam,
    verifySecurityEvent,
    getCommitment,
    getCommitmentHistory,
    getRecentCommitments,
    getOutboxStatus,
    getPendingOutbox,
    getLedgerHeight,
    getFabricBlocks,
    getIntegrityAlerts,
    dismissIntegrityAlerts,
    clearIntegrityAlerts,
    verifyAllCommitments,
    triggerReconciliation,
    getOutboxStats,
    startRecommit,
    getRecommitStatus,
    stopRecommit,
    reconnectFabric,
} from '../controllers/integrity.controllers.js';
import { verifyAdminOrAuditorJWT } from '../middlewares/auth.middleware.js';
import { cacheMiddleware, invalidateCacheMiddleware } from '../middlewares/cache.middleware.js';

const router = Router();

const integrityCache = (ttl = 15) => cacheMiddleware({ ttl, prefix: 'zl:api:integrity:' });
const invalidateIntegrity = () => invalidateCacheMiddleware(['zl:api:integrity:*', 'fabric:*']);

// Public read-only network health status & ledger metrics
router.get('/fabric-status', integrityCache(25), getFabricStatus);
router.get('/ledger-height', integrityCache(15), getLedgerHeight);

// Protected integrity routes require Admin OR Auditor JWT
// Support accounts are blocked by verifyAdminOrAuditorJWT (Admin.isSupport check)
router.use(verifyAdminOrAuditorJWT);

router.get('/recent', integrityCache(15), getRecentCommitments);
router.get('/blocks', integrityCache(20), getFabricBlocks);
router.get('/alerts', integrityCache(15), getIntegrityAlerts);
router.post('/alerts/dismiss', invalidateIntegrity(), dismissIntegrityAlerts);
router.delete('/alerts', invalidateIntegrity(), clearIntegrityAlerts);

// Outbox reconciliation & bulk ledger verification
router.post('/reconcile', invalidateIntegrity(), triggerReconciliation);
router.post('/verify-ledger', invalidateIntegrity(), verifyAllCommitments);

// Outbox stats & Recommit engine
router.get('/outbox/stats', integrityCache(15), getOutboxStats);
router.post('/outbox/recommit', invalidateIntegrity(), startRecommit);
router.get('/outbox/recommit-status', getRecommitStatus);
router.post('/outbox/recommit-stop', invalidateIntegrity(), stopRecommit);
router.post('/fabric/reconnect', invalidateIntegrity(), reconnectFabric);

// Entity verification
router.get('/result/:resultId', verifyResult);
router.get('/batch/:batchId', verifyBatch);
router.get('/exam/:examId', verifyExam);
router.get('/event/:eventId', verifySecurityEvent);

// Raw commitment lookup
router.get('/commitment/:commitmentId', getCommitment);
router.get('/commitment/:commitmentId/history', getCommitmentHistory);

// Outbox monitoring
router.get('/outbox/pending', getPendingOutbox);
router.get('/outbox/:entityType/:entityId', getOutboxStatus);

export default router;
