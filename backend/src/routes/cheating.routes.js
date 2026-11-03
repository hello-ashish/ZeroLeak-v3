import { Router } from "express";
import {
    recordIncident,
    terminateAttempt,
    getIncidents,
    getBlockedStudents,
    getUnblockedStudents,
    unblockStudent,
    authorizeNewAttempt,
    getMyExamIncidentCount,
    getPendingTerminatedExams
} from "../controllers/cheating.controllers.js";
import {
    verifyStudentJWT,
    verifyAdminJWT,
    verifyAdminOrAuditorJWT
} from "../middlewares/auth.middleware.js";

const router = Router();

// Student Protected Routes
router.route("/incident").post(verifyStudentJWT, recordIncident);
router.route("/terminate").post(verifyStudentJWT, terminateAttempt);
// Student fetches their own violation count for a specific exam (used to enforce 3-strike on page load)
router.route("/my-count/:examId").get(verifyStudentJWT, getMyExamIncidentCount);

// Admin & Auditor Protected Telemetry Routes
router.route("/incidents").get(verifyAdminOrAuditorJWT, getIncidents);
router.route("/blocked-students").get(verifyAdminOrAuditorJWT, getBlockedStudents);
router.route("/unblocked-students").get(verifyAdminOrAuditorJWT, getUnblockedStudents);

// Admin Only Routes
router.route("/unblock/:studentId").post(verifyAdminJWT, unblockStudent);
// Fetches pending terminated exams for a specific student
router.route("/terminated-exams/:studentId").get(verifyAdminJWT, getPendingTerminatedExams);
// Authorizes a fresh exam attempt for a student whose terminated attempt is blocking them.
// This does NOT delete the old terminated record — it marks it resetByAdmin=true for audit.
router.route("/authorize-attempt/:studentId/:examId").post(verifyAdminJWT, authorizeNewAttempt);

export default router;
