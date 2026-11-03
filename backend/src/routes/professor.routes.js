import { Router } from "express"
import { loginProfessor, logoutProfessor } from "../controllers/professor.controllers.js"
import { createBatch, getMyBatches, addQuestionToBatch, bulkAddQuestionsToBatch, editQuestionInBatch, deleteQuestionFromBatch, submitBatch, updateProfessorProfile, changeProfessorPassword, deleteBatch } from "../controllers/professor.controllers.js"
import { verifyProfessorJWT } from "../middlewares/auth.middleware.js"
import notificationRouter from "./notification.routes.js"

import { loginRateLimit } from "../middlewares/rateLimit.middleware.js"

const router = Router()

router.use("/notifications", verifyProfessorJWT, notificationRouter)

// route to login professor
router.route("/login").post(loginRateLimit(), loginProfessor)
router.route("/logout").post(verifyProfessorJWT, logoutProfessor)

router.route("/profile").put(verifyProfessorJWT, updateProfessorProfile)
router.route("/change-password").put(verifyProfessorJWT, changeProfessorPassword)
router.route("/batches").post(verifyProfessorJWT, createBatch)
router.route("/batches").get(verifyProfessorJWT, getMyBatches)
router.route("/batches/:batchId/questions").post(verifyProfessorJWT, addQuestionToBatch)
router.route("/batches/:batchId/questions/bulk").post(verifyProfessorJWT, bulkAddQuestionsToBatch)
router.route("/batches/:batchId/questions/:questionId").put(verifyProfessorJWT, editQuestionInBatch)
router.route("/batches/:batchId/questions/:questionId").delete(verifyProfessorJWT, deleteQuestionFromBatch)
router.route("/batches/:batchId/submit").post(verifyProfessorJWT, submitBatch)
router.route("/batches/:batchId").delete(verifyProfessorJWT, deleteBatch)

export default router