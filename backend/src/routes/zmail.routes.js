/**
 * ZMail Routes
 * Base: /api/zmail
 * All routes require authentication via verifyAnyJWT.
 */

import { Router } from "express";
import { verifyAnyJWT, verifyAdminJWT } from "../middlewares/auth.middleware.js";
import * as zmailController from "../controllers/zmail.controllers.js";

// ─── ZMail-specific rate limiter ──────────────────────────────────────────────
import redisClient from "../redis/index.js";

function zmailRateLimit(keyPrefix, maxRequests, windowSeconds = 60) {
    return async (req, res, next) => {
        try {
            const u = req.user || req.admin || req.professor || req.student || req.auditor;
            const userId = u?._id?.toString();
            if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });

            if (!redisClient.isOpen) return next();

            const key = `zmail:rl:${keyPrefix}:${userId}`;
            const current = await redisClient.incr(key);
            if (current === 1) await redisClient.expire(key, windowSeconds);

            if (current > maxRequests) {
                const ttl = await redisClient.ttl(key);
                return res.status(429).json({
                    success: false,
                    error: "Too many requests. Please try again later.",
                    retryAfter: ttl > 0 ? ttl : windowSeconds,
                });
            }
            next();
        } catch {
            next();
        }
    };
}

const router = Router();

// All ZMail routes require authentication
router.use(verifyAnyJWT);

// ─── Account ──────────────────────────────────────────────────────────────────
router.get("/account", zmailController.getMyAccount);
router.get("/counts", zmailController.getCounts);

// ─── Mailbox Folders ──────────────────────────────────────────────────────────
router.get("/inbox",     zmailController.getInbox);
router.get("/sent",      zmailController.getSent);
router.get("/drafts",    zmailController.getDrafts);
router.get("/starred",   zmailController.getStarred);
router.get("/important", zmailController.getImportant);
router.get("/archive",   zmailController.getArchive);
router.get("/trash",     zmailController.getTrash);
router.get("/all",       zmailController.getAllMail);

// ─── Messages ─────────────────────────────────────────────────────────────────
router.post(
    "/messages",
    zmailRateLimit("send", 30, 60),   // 30 sends per minute per user
    zmailController.sendMessage
);
router.get("/messages/:messageId",                            zmailController.getMessage);
router.post("/messages/:messageId/reply",
    zmailRateLimit("reply", 30, 60),
    zmailController.replyToMessage
);
router.post("/messages/:messageId/forward",
    zmailRateLimit("forward", 20, 60),
    zmailController.forwardMessage
);
router.patch("/messages/:messageId/read",      zmailController.markRead);
router.patch("/messages/:messageId/unread",    zmailController.markUnread);
router.patch("/messages/:messageId/star",      zmailController.starMessage);
router.patch("/messages/:messageId/important", zmailController.markImportant);
router.patch("/messages/:messageId/archive",   zmailController.archiveMessage);
router.patch("/messages/:messageId/trash",     zmailController.trashMessage);
router.patch("/messages/:messageId/restore",   zmailController.restoreMessage);
router.delete("/messages/:messageId",          zmailController.permanentlyDeleteMessage);
router.patch("/messages/bulk/action",            zmailController.bulkAction);

// Attachment download — auth enforced, attachment ownership verified in controller
router.get(
    "/messages/:messageId/attachments/:attachmentId",
    zmailController.downloadAttachment
);

// ─── Threads ──────────────────────────────────────────────────────────────────
router.get("/threads/:threadId",            zmailController.getThread);
router.patch("/threads/:threadId/read",     zmailController.markThreadRead);

// ─── Trash ────────────────────────────────────────────────────────────────────
router.delete("/trash/empty", zmailController.emptyTrash);

// ─── Drafts ───────────────────────────────────────────────────────────────────
router.post(
    "/drafts",
    zmailRateLimit("draft", 100, 60),
    zmailController.createDraft
);
router.get("/drafts/:draftId",           zmailController.getDraft);
router.patch(
    "/drafts/:draftId",
    zmailRateLimit("draft", 100, 60),
    zmailController.updateDraft
);
router.post("/drafts/:draftId/send",     zmailController.sendDraft);
router.delete("/drafts/:draftId",        zmailController.deleteDraft);

// ─── Search ───────────────────────────────────────────────────────────────────
router.get(
    "/search",
    zmailRateLimit("search", 20, 30),
    zmailController.searchMail
);

// ─── User/Recipient search (autocomplete) ─────────────────────────────────────
router.get(
    "/users/search",
    zmailRateLimit("usersearch", 30, 30),
    zmailController.searchUsers
);

// ─── Attachment upload ────────────────────────────────────────────────────────
router.post(
    "/attachments/upload",
    zmailRateLimit("upload", 20, 60),
    zmailController.uploadAttachment
);

// ─── Admin-only ───────────────────────────────────────────────────────────────
router.post(
    "/admin/backfill",
    verifyAdminJWT,
    zmailController.triggerBackfill
);

export default router;
