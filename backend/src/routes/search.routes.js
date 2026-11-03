import { Router } from "express";
import { globalSearch } from "../controllers/search.controllers.js";
import { verifyAnyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/").get(verifyAnyJWT, globalSearch);

export default router;
