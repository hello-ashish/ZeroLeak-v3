import { Router } from "express"
import {
    createProfessor,
    getAllProfessors,
    deleteProfessor,
    registerAdmin,
    registerSupportMember,
    getAllSupportMembers,
    deleteSupportMember,
    toggleBlockSupportMember,
    bulkDeleteSupportMembers,
    bulkBlockSupportMembers,
    getAllAuditors,
    deleteAuditor,
    toggleBlockAuditor,
    bulkDeleteAuditors,
    bulkBlockAuditors,
    loginAdmin,
    logoutAdmin,
    updateAdminProfile,
    getBatches,
    openBatchDetails,
    reviewBatch,
    deleteBatch,
    getDashboardStats,
    getAuditLogs,
    updateExamStatus,
    toggleExamResultsRelease,
    deleteExam,
    deleteStudent,
    getLiveStudents,
    toggleBlockStudent,
    toggleBlockProfessor,
    bulkDeleteProfessors,
    bulkBlockProfessors,
    bulkImportProfessors,
    bulkDeleteStudents,
    bulkBlockStudents,
    bulkImportStudents,
    broadcastAnnouncement
} from "../controllers/admin.controllers.js"
import { verifyAdminJWT } from "../middlewares/auth.middleware.js"
import { cacheMiddleware, invalidateCacheMiddleware } from "../middlewares/cache.middleware.js"
import notificationRouter from "./notification.routes.js"
import { registerAuditor } from "../controllers/auditor.controllers.js"

const router = Router()

const adminCache = (ttl = 30) => cacheMiddleware({ ttl, prefix: 'zl:api:admin:' });
const invalidateAdmin = () => invalidateCacheMiddleware(['zl:api:admin:*']);

router.use("/notifications", verifyAdminJWT, notificationRouter)

// ─── Public Routes ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/register:
 *   post:
 *     summary: Register a new admin
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminId:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Admin registered successfully
 *       400:
 *         description: Bad request
 */
router.route("/register").post(registerAdmin)

import { loginRateLimit } from "../middlewares/rateLimit.middleware.js"

router.route("/login").post(loginRateLimit(), loginAdmin)
router.route("/logout").post(verifyAdminJWT, logoutAdmin)

// ─── Protected Routes ─────────────────────────────────────────────────────────

// Dashboard Stats
router.route("/stats").get(verifyAdminJWT, adminCache(30), getDashboardStats)

// Audit Logs
router.route("/audit-logs").get(verifyAdminJWT, getAuditLogs)

// Admin Profile
router.route("/profile").put(verifyAdminJWT, updateAdminProfile)

// Auditor Management
router.route("/auditors").post(verifyAdminJWT, registerAuditor)
router.route("/auditors").get(verifyAdminJWT, getAllAuditors)
router.route("/auditors/bulk-delete").post(verifyAdminJWT, bulkDeleteAuditors)
router.route("/auditors/bulk-block").post(verifyAdminJWT, bulkBlockAuditors)
router.route("/auditors/:id/block").post(verifyAdminJWT, toggleBlockAuditor)
router.route("/auditors/:id").delete(verifyAdminJWT, deleteAuditor)

// Support Member Management
router.route("/support-members").post(verifyAdminJWT, registerSupportMember)
router.route("/support-members").get(verifyAdminJWT, getAllSupportMembers)
router.route("/support-members/bulk-delete").post(verifyAdminJWT, bulkDeleteSupportMembers)
router.route("/support-members/bulk-block").post(verifyAdminJWT, bulkBlockSupportMembers)
router.route("/support-members/:id/block").post(verifyAdminJWT, toggleBlockSupportMember)
router.route("/support-members/:id").delete(verifyAdminJWT, deleteSupportMember)

// Professor Management
router.route("/professors/bulk-import").post(verifyAdminJWT, bulkImportProfessors)
router.route("/professors/bulk-delete").post(verifyAdminJWT, bulkDeleteProfessors)
router.route("/professors/bulk-block").post(verifyAdminJWT, bulkBlockProfessors)
router.route("/professors").post(verifyAdminJWT, createProfessor)
router.route("/professors").get(verifyAdminJWT, getAllProfessors)
router.route("/professors/:id/block").post(verifyAdminJWT, toggleBlockProfessor)
router.route("/professors/:id").delete(verifyAdminJWT, deleteProfessor)

// Student Management
router.route("/students/bulk-import").post(verifyAdminJWT, bulkImportStudents)
router.route("/students/bulk-delete").post(verifyAdminJWT, bulkDeleteStudents)
router.route("/students/bulk-block").post(verifyAdminJWT, bulkBlockStudents)
router.route("/students/live").get(verifyAdminJWT, getLiveStudents)
router.route("/students/:id/block").post(verifyAdminJWT, toggleBlockStudent)
router.route("/students/:id").delete(verifyAdminJWT, deleteStudent)

// Batch Management
router.route("/batches").get(verifyAdminJWT, getBatches)
router.route("/batches/:batchId").get(verifyAdminJWT, openBatchDetails)
router.route("/batches/:batchId").delete(verifyAdminJWT, deleteBatch)
router.route("/batches/:batchId/review").post(verifyAdminJWT, reviewBatch)

// Exam Management (status + delete)
router.route("/exams/:id/status").patch(verifyAdminJWT, updateExamStatus)
router.route("/exams/:id/release-results").patch(verifyAdminJWT, toggleExamResultsRelease)
router.route("/exams/:id").delete(verifyAdminJWT, deleteExam)

// Global Announcements
router.route("/broadcast").post(verifyAdminJWT, broadcastAnnouncement)

export default router