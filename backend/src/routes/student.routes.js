import { Router } from "express";
import { registerStudent, loginStudent, logoutStudent, getAvailableExams, getAllStudents, getExamById, submitExamResult, getStudentResults, updateStudentProfile, changeStudentPassword, pingSession } from "../controllers/student.controllers.js";
import { verifyStudentJWT, verifyAdminJWT } from "../middlewares/auth.middleware.js";
import notificationRouter from "./notification.routes.js";

import { loginRateLimit } from "../middlewares/rateLimit.middleware.js";

const router = Router();

router.use("/notifications", verifyStudentJWT, notificationRouter);

// Public Routes
router.route("/login").post(loginRateLimit(), loginStudent);
router.route("/logout").post(verifyStudentJWT, logoutStudent);

// Admin protected route for registering students
router.route("/register").post(verifyAdminJWT, registerStudent);
router.route("/").get(verifyAdminJWT, getAllStudents);

// Protected Route: Only logged in students can see the exams
router.route("/ping").post(verifyStudentJWT, pingSession);
router.route("/exams").get(verifyStudentJWT, getAvailableExams);
router.route("/exams/:id").get(verifyStudentJWT, getExamById);
router.route("/profile").put(verifyStudentJWT, updateStudentProfile)
router.route("/change-password").put(verifyStudentJWT, changeStudentPassword)

// Protected Route: Only logged in students can submit exam results
router.route("/results")
    .post(verifyStudentJWT, submitExamResult)
    .get(verifyStudentJWT, getStudentResults);

export default router;