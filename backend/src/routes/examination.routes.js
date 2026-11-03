import { Router } from "express";
import { 
    createExamination, 
    getExaminations, 
    updateExaminationStatus, 
    toggleExaminationResults,
    deleteExamination 
} from "../controllers/examination.controllers.js";
import { verifyAdminJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/")
    .post(verifyAdminJWT, createExamination)
    .get(verifyAdminJWT, getExaminations);

router.route("/:id/status")
    .patch(verifyAdminJWT, updateExaminationStatus);

router.route("/:id/release-results")
    .patch(verifyAdminJWT, toggleExaminationResults);

router.route("/:id")
    .delete(verifyAdminJWT, deleteExamination);

export default router;
