/**
 * Support Routes
 * Base: /api/support
 *
 * Public (any authenticated user):
 *   GET  /constants
 *   POST /tickets
 *   GET  /my-tickets
 *   GET  /my-tickets/:ticketId
 *   POST /my-tickets/:ticketId/reply
 *
 * Support team only (admin + isSupport):
 *   GET   /tickets
 *   GET   /tickets/:ticketId
 *   PATCH /tickets/:ticketId/status
 *   PATCH /tickets/:ticketId/priority
 *   PATCH /tickets/:ticketId/assign
 *   POST  /tickets/:ticketId/reply
 *   POST  /tickets/:ticketId/notes
 *   GET   /tickets/:ticketId/notes
 *   GET   /tickets/:ticketId/history
 *   GET   /stats
 */

import { Router } from "express";
import { verifyAnyJWT, verifySupportJWT } from "../middlewares/auth.middleware.js";
import * as supportController from "../controllers/support.controllers.js";

const router = Router();

import { loginRateLimit } from "../middlewares/rateLimit.middleware.js";

// ── Auth ────────────────────────────────────────────────────────────────────────
router.post("/login", loginRateLimit(), supportController.supportLogin);
router.post("/logout", verifySupportJWT, supportController.logoutSupport);

// ── Public constants (any authenticated user) ──────────────────────────────────
router.get("/constants", verifyAnyJWT, supportController.getConstants);

// ── User-facing endpoints ──────────────────────────────────────────────────────
router.post("/tickets",                       verifyAnyJWT, supportController.createTicket);
router.get("/my-tickets",                     verifyAnyJWT, supportController.getMyTickets);
router.get("/my-tickets/:ticketId",           verifyAnyJWT, supportController.getMyTicket);
router.post("/my-tickets/:ticketId/reply",    verifyAnyJWT, supportController.userReply);

// ── Support team endpoints (isSupport admin only) ──────────────────────────────
router.put("/profile",                        verifySupportJWT, supportController.updateSupportProfile);
router.get("/tickets",                        verifySupportJWT, supportController.listTickets);
router.get("/global-history",                 verifySupportJWT, supportController.getGlobalHistory);
router.get("/stats",                          verifySupportJWT, supportController.getStats);
router.get("/tickets/:ticketId",              verifySupportJWT, supportController.getTicket);
router.patch("/tickets/:ticketId/status",     verifySupportJWT, supportController.changeStatus);
router.patch("/tickets/:ticketId/priority",   verifySupportJWT, supportController.changePriority);
router.patch("/tickets/:ticketId/assign",     verifySupportJWT, supportController.assignTicket);
router.post("/tickets/:ticketId/reply",       verifySupportJWT, supportController.supportReply);
router.post("/tickets/:ticketId/notes",       verifySupportJWT, supportController.addInternalNote);
router.get("/tickets/:ticketId/notes",        verifySupportJWT, supportController.getInternalNotes);
router.get("/tickets/:ticketId/history",      verifySupportJWT, supportController.getTicketHistory);

export default router;
