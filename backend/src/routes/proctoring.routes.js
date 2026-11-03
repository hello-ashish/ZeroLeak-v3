import { Router } from "express";
import {
    getLiveStudents,
    getSuspiciousAlerts,
    getActiveSessions,
    getSessionDetail,
    getSessionIncidents,
    getSessionAIEvents,
    getStudentIncidents,
    getAllIncidents,
    endSession,
    getActiveExams,
    getExamSessions
} from "../controllers/proctoring.controllers.js";
import { verifyAdminJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyAdminJWT);

// ── Live dashboard ──────────────────────────────────────────────────────────
// Lightweight metadata only — no MediaStream data
router.get("/live",       getLiveStudents);

// AI alert / suspicious students
router.get("/alerts",     getSuspiciousAlerts);

// Active exams with session counts
router.get("/active-exams", getActiveExams);

// ── Session endpoints ───────────────────────────────────────────────────────
router.get("/sessions",                            getActiveSessions);
router.get("/sessions/:sessionId",                 getSessionDetail);
router.get("/sessions/:sessionId/incidents",       getSessionIncidents);
router.get("/sessions/:sessionId/ai-events",       getSessionAIEvents);
router.post("/sessions/:sessionId/end",            endSession);

// ── Exam-scoped ─────────────────────────────────────────────────────────────
router.get("/exams/:examId/sessions", getExamSessions);

// ── Student-scoped (legacy + support) ──────────────────────────────────────
router.get("/students/:studentId/incidents", getStudentIncidents);
router.get("/incidents",                     getAllIncidents);

export default router;
