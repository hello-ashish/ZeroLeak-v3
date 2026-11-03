import { Router } from "express";
import { createExam, getExams, getExamResults, bulkDeleteResults } from "../controllers/exam.controllers.js";
import { verifyAdminJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Route to create a new exam
router.route("/")
    .post(verifyAdminJWT, createExam)
    .get(verifyAdminJWT, getExams);

// Route to get all student results
router.route("/results")
    .get(verifyAdminJWT, getExamResults);

// Route to delete multiple student results
router.route("/results/bulk-delete")
    .post(verifyAdminJWT, bulkDeleteResults);

export default router;
