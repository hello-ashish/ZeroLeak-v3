import { Router } from "express"
import { getProfessorQuestions, getAllQuestions, simulatePaper } from "../controllers/question.controllers.js"
import { verifyProfessorJWT, verifyAdminJWT } from "../middlewares/auth.middleware.js"

const router = Router()

// Route to get all questions (Admin)
router.route("/")
// .post(verifyProfessorJWT, createQuestion) // Disabled: Use batches
.get(verifyAdminJWT, getAllQuestions)

router.route("/simulate")
.get(verifyAdminJWT, simulatePaper)

export default router