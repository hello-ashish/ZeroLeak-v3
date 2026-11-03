import { Router } from "express";
import {
    registerAuditor,
    loginAuditor,
    logoutAuditor,
    getDashboardMetrics,
    getAuditLogs,
    getAnomalies,
    updateAnomalyStatus,
    scanAnomalies,
    getExams,
    getStudents,
    getProfessors,
    updateAuditorProfile
} from "../controllers/auditor.controllers.js";
import { verifyAuditorJWT } from "../middlewares/auth.middleware.js";
import notificationRouter from "./notification.routes.js";

const router = Router();

import { loginRateLimit } from "../middlewares/rateLimit.middleware.js";

// ─── Public Routes ────────────────────────────────────────────────────────────
// Note: Auditor registration is moved to admin.routes.js
router.route("/login").post(loginRateLimit(), loginAuditor);
router.route("/logout").post(verifyAuditorJWT, logoutAuditor);

// ─── Protected Routes (Read-Only & Auditor Specific) ──────────────────────────
router.use(verifyAuditorJWT); // Apply to all below

router.route("/profile").put(updateAuditorProfile);
router.use("/notifications", notificationRouter);

router.route("/metrics").get(getDashboardMetrics);
router.route("/logs").get(getAuditLogs);

router.route("/anomalies").get(getAnomalies);
router.route("/anomalies/scan").post(scanAnomalies);
router.route("/anomalies/:id/status").patch(updateAnomalyStatus);

// Read-only data for the explorer
router.route("/exams").get(getExams);
router.route("/students").get(getStudents);
router.route("/professors").get(getProfessors);

export default router;
