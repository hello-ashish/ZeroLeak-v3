/**
 * ZMail Controller
 *
 * Thin controller layer. All business logic lives in zmail.service.js.
 * Controllers handle:
 *   - Request/response formatting
 *   - Input extraction from req
 *   - Error formatting
 *   - Delegating to service
 *
 * Authentication is enforced upstream by verifyAnyJWT middleware.
 * The authenticated user is always taken from req.user (set by verifyAnyJWT).
 * Client-supplied "from" addresses are IGNORED.
 */

import mongoose from "mongoose";
import * as zmailService from "../Services/zmail/zmail.service.js";
import { ensureZMailAccount, getAccountByUserId } from "../Services/zmail/zmailIdentity.service.js";
import { getZMailNamespace } from "../sockets/zmail.socket.js";
import path from "path";
import fs from "fs";

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { SUPPORT_SYSTEM_ID } from "../Services/support/supportIdentity.service.js";

function getUserId(req) {
    if (req.userRole === "Support") return SUPPORT_SYSTEM_ID;
    return (req.user || req.admin || req.professor || req.student || req.auditor)?._id;
}

function getUserRole(req) {
    return req.userRole || (req.admin ? "Admin" : req.professor ? "Professor" : req.student ? "Student" : "Auditor");
}

function getUserDisplayName(req) {
    const u = req.user || req.admin || req.professor || req.student || req.auditor;
    return u?.name || u?.email?.split("@")[0] || "User";
}

function getUserLoginEmail(req) {
    const u = req.user || req.admin || req.professor || req.student || req.auditor;
    return u?.email || "";
}

function ok(res, data, status = 200) {
    return res.status(status).json({ success: true, ...data });
}

function err(res, message, status = 400) {
    return res.status(status).json({ success: false, error: message });
}

/**
 * Auto-provision the ZMail account for the authenticated user if missing.
 */
async function getOrProvisionAccount(req) {
    const userId = getUserId(req);
    const role = getUserRole(req);
    const displayName = getUserDisplayName(req);
    const loginEmail = getUserLoginEmail(req);
    return ensureZMailAccount({ userId, userType: role, displayName, loginEmail });
}

// ─── Account ──────────────────────────────────────────────────────────────────

export const getMyAccount = async (req, res) => {
    try {
        const account = await getOrProvisionAccount(req);
        return ok(res, {
            account: {
                zmailAddress: account.zmailAddress,
                displayName: account.displayName,
                userType: account.userType,
                storageUsedBytes: account.storageUsedBytes,
                mailboxStatus: account.mailboxStatus,
            },
        });
    } catch (e) {
        return err(res, e.message, 500);
    }
};

// ─── Mailbox Folders ──────────────────────────────────────────────────────────

async function getFolder(req, res, folder) {
    try {
        await getOrProvisionAccount(req);
        const userId = getUserId(req);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 25;
        const result = await zmailService.getMailboxFolder({ userId, folder, page, limit });
        return ok(res, result);
    } catch (e) {
        return err(res, e.message, 500);
    }
}

export const getInbox      = (req, res) => getFolder(req, res, "inbox");
export const getSent       = (req, res) => getFolder(req, res, "sent");
export const getDrafts     = (req, res) => getFolder(req, res, "drafts");
export const getStarred    = (req, res) => getFolder(req, res, "starred");
export const getImportant  = (req, res) => getFolder(req, res, "important");
export const getArchive    = (req, res) => getFolder(req, res, "archive");
export const getTrash      = (req, res) => getFolder(req, res, "trash");
export const getAllMail     = (req, res) => getFolder(req, res, "all");

// ─── Counts ───────────────────────────────────────────────────────────────────

export const getCounts = async (req, res) => {
    try {
        const userId = getUserId(req);
        const [unread, drafts] = await Promise.all([
            zmailService.getUnreadCount(userId),
            zmailService.getDraftCount(userId),
        ]);
        return ok(res, { unread, drafts });
    } catch (e) {
        return err(res, e.message, 500);
    }
};

// ─── Messages ─────────────────────────────────────────────────────────────────

export const sendMessage = async (req, res) => {
    try {
        const senderUserId = getUserId(req);
        await getOrProvisionAccount(req);

        const { to, cc, bcc, subject, body, attachments, replyToMessageId, forwardedFromMessageId, existingThreadId } = req.body;

        if (!to || !Array.isArray(to) || to.length === 0) {
            return err(res, "Recipient list (to) is required");
        }

        const io = getZMailNamespace();

        const result = await zmailService.sendMail({
            senderUserId,
            to,
            cc: cc || [],
            bcc: bcc || [],
            subject,
            body,
            attachments: attachments || [],
            replyToMessageId,
            forwardedFromMessageId,
            existingThreadId,
            io,
        });

        return ok(res, {
            message: {
                messageId: result.message._id,
                threadId: result.thread._id,
                subject: result.message.subject,
                sentAt: result.message.sentAt,
            },
        }, 201);
    } catch (e) {
        console.error("[ZMail] sendMessage error:", e.message);
        return err(res, e.message, 400);
    }
};

export const getMessage = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { messageId } = req.params;
        const message = await zmailService.getMessage({ userId, messageId });
        return ok(res, { message });
    } catch (e) {
        const status = e.message.includes("access denied") || e.message.includes("not found") ? 404 : 400;
        return err(res, e.message, status);
    }
};

export const replyToMessage = async (req, res) => {
    try {
        const senderUserId = getUserId(req);
        const { messageId } = req.params;
        const { body, attachments, replyAll } = req.body;
        const io = getZMailNamespace();
        const result = await zmailService.replyToMessage({
            senderUserId,
            messageId,
            body,
            attachments: attachments || [],
            replyAll: !!replyAll,
            io,
        });
        return ok(res, { message: result.message, thread: result.thread }, 201);
    } catch (e) {
        return err(res, e.message, 400);
    }
};

export const forwardMessage = async (req, res) => {
    try {
        const senderUserId = getUserId(req);
        const { messageId } = req.params;
        const { to, body, attachments } = req.body;
        const io = getZMailNamespace();
        const result = await zmailService.forwardMessage({
            senderUserId,
            messageId,
            to,
            body: body || "",
            attachments: attachments || [],
            io,
        });
        return ok(res, { message: result.message, thread: result.thread }, 201);
    } catch (e) {
        return err(res, e.message, 400);
    }
};

export const markRead = async (req, res) => {
    try {
        const userId = getUserId(req);
        const entry = await zmailService.markRead({ userId, messageId: req.params.messageId });
        return ok(res, { updated: true, isRead: entry.isRead });
    } catch (e) {
        return err(res, e.message, 400);
    }
};

export const markUnread = async (req, res) => {
    try {
        const userId = getUserId(req);
        const entry = await zmailService.markUnread({ userId, messageId: req.params.messageId });
        return ok(res, { updated: true, isRead: entry.isRead });
    } catch (e) {
        return err(res, e.message, 400);
    }
};

export const starMessage = async (req, res) => {
    try {
        const userId = getUserId(req);
        const starred = req.body.starred !== false;
        const entry = await zmailService.starMessage({ userId, messageId: req.params.messageId, starred });
        return ok(res, { updated: true, isStarred: entry.isStarred });
    } catch (e) {
        return err(res, e.message, 400);
    }
};

export const markImportant = async (req, res) => {
    try {
        const userId = getUserId(req);
        const important = req.body.important !== false;
        const entry = await zmailService.markImportant({ userId, messageId: req.params.messageId, important });
        return ok(res, { updated: true, isImportant: entry.isImportant });
    } catch (e) {
        return err(res, e.message, 400);
    }
};

export const archiveMessage = async (req, res) => {
    try {
        const userId = getUserId(req);
        await zmailService.archiveMessage({ userId, messageId: req.params.messageId });
        return ok(res, { archived: true });
    } catch (e) {
        return err(res, e.message, 400);
    }
};

export const trashMessage = async (req, res) => {
    try {
        const userId = getUserId(req);
        await zmailService.trashMessage({ userId, messageId: req.params.messageId });
        return ok(res, { trashed: true });
    } catch (e) {
        return err(res, e.message, 400);
    }
};

export const restoreMessage = async (req, res) => {
    try {
        const userId = getUserId(req);
        await zmailService.restoreMessage({ userId, messageId: req.params.messageId });
        return ok(res, { restored: true });
    } catch (e) {
        return err(res, e.message, 400);
    }
};

export const permanentlyDeleteMessage = async (req, res) => {
    try {
        const userId = getUserId(req);
        await zmailService.permanentlyDeleteEntry({ userId, messageId: req.params.messageId });
        return ok(res, { deleted: true });
    } catch (e) {
        return err(res, e.message, 400);
    }
};

export const bulkAction = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { messageIds, action } = req.body;
        const result = await zmailService.bulkAction({ userId, messageIds, action });
        return ok(res, result);
    } catch (e) {
        return err(res, e.message, 400);
    }
};

export const emptyTrash = async (req, res) => {
    try {
        const userId = getUserId(req);
        const result = await zmailService.emptyTrash({ userId });
        return ok(res, result);
    } catch (e) {
        return err(res, e.message, 500);
    }
};

// ─── Threads ──────────────────────────────────────────────────────────────────

export const getThread = async (req, res) => {
    try {
        const userId = getUserId(req);
        const result = await zmailService.getThread({ userId, threadId: req.params.threadId });
        return ok(res, result);
    } catch (e) {
        const status = e.message.includes("denied") || e.message.includes("not found") ? 404 : 400;
        return err(res, e.message, status);
    }
};

export const markThreadRead = async (req, res) => {
    try {
        const userId = getUserId(req);
        await zmailService.markThreadRead({ userId, threadId: req.params.threadId });
        return ok(res, { updated: true });
    } catch (e) {
        return err(res, e.message, 400);
    }
};

// ─── Drafts ───────────────────────────────────────────────────────────────────

export const createDraft = async (req, res) => {
    try {
        const senderUserId = getUserId(req);
        await getOrProvisionAccount(req);
        const { to, cc, bcc, subject, body, attachments } = req.body;
        const result = await zmailService.createDraft({
            senderUserId,
            to: to || [],
            cc: cc || [],
            bcc: bcc || [],
            subject: subject || "",
            body: body || "",
            attachments: attachments || [],
        });
        return ok(res, { draftId: result.message._id, threadId: result.thread._id }, 201);
    } catch (e) {
        return err(res, e.message, 400);
    }
};

export const updateDraft = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { draftId } = req.params;
        const { to, cc, bcc, subject, body, attachments, version } = req.body;
        const updated = await zmailService.updateDraft({
            userId,
            draftId,
            updates: { to, cc, bcc, subject, body, attachments },
            clientVersion: version,
        });
        return ok(res, { draftId: updated._id, version: updated.draftVersion });
    } catch (e) {
        const status = e.message.includes("conflict") ? 409 : e.message.includes("access denied") ? 403 : 400;
        return err(res, e.message, status);
    }
};

export const getDraft = async (req, res) => {
    try {
        const userId = getUserId(req);
        const message = await zmailService.getMessage({ userId, messageId: req.params.draftId });
        if (!message.isDraft) return err(res, "Not a draft", 404);
        return ok(res, { draft: message });
    } catch (e) {
        return err(res, e.message, 404);
    }
};

export const sendDraft = async (req, res) => {
    try {
        const userId = getUserId(req);
        const io = getZMailNamespace();
        const message = await zmailService.sendDraft({ userId, draftId: req.params.draftId, io });
        return ok(res, { messageId: message._id, sentAt: message.sentAt }, 201);
    } catch (e) {
        return err(res, e.message, 400);
    }
};

export const deleteDraft = async (req, res) => {
    try {
        const userId = getUserId(req);
        await zmailService.deleteDraft({ userId, draftId: req.params.draftId });
        return ok(res, { deleted: true });
    } catch (e) {
        return err(res, e.message, 400);
    }
};

// ─── Search ───────────────────────────────────────────────────────────────────

export const searchMail = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { q, page, limit } = req.query;
        if (!q || q.trim().length === 0) {
            return err(res, "Search query is required", 400);
        }
        const result = await zmailService.searchMail({
            userId,
            query: q.trim(),
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 25,
        });
        return ok(res, result);
    } catch (e) {
        return err(res, e.message, 500);
    }
};

// ─── User/Recipient search ────────────────────────────────────────────────────

export const searchUsers = async (req, res) => {
    try {
        const { q } = req.query;
        const results = await zmailService.searchUsers({ query: q || "", limit: 10 });
        return ok(res, { users: results });
    } catch (e) {
        return err(res, e.message, 500);
    }
};

// ─── Attachment upload (simple local file storage) ────────────────────────────

// Upload directory: backend/data/zmail-attachments/
// In production, swap storageKey logic to S3/GCS.
const UPLOAD_DIR = path.join(process.cwd(), "data", "zmail-attachments");

// Ensure upload directory exists
try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch { /* already exists */ }

function sanitizeFilename(name) {
    return name
        .replace(/\.\./g, "")         // no path traversal
        .replace(/[/\\]/g, "")        // no directory separators
        .replace(/[^a-zA-Z0-9._\- ]/g, "_") // safe chars only
        .trim()
        .slice(0, 255);
}

/**
 * Upload attachment.
 * Expects multipart/form-data with a single file field "file".
 * Uses base64 body if no multipart middleware is configured.
 * 
 * NOTE: For production, integrate multer + S3 here.
 * This implementation accepts base64 file data in JSON for simplicity.
 */
export const uploadAttachment = async (req, res) => {
    try {
        const { filename, mimeType, base64data } = req.body;
        if (!filename || !mimeType || !base64data) {
            return err(res, "filename, mimeType, and base64data are required");
        }

        const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
        const buffer = Buffer.from(base64data, "base64");
        if (buffer.length > MAX_SIZE) {
            return err(res, "File exceeds 25 MB limit");
        }

        const sanitized = sanitizeFilename(filename);
        const unique = `${Date.now()}_${Math.random().toString(36).slice(2)}_${sanitized}`;
        const storagePath = path.join(UPLOAD_DIR, unique);

        // Security: ensure the resolved path is inside UPLOAD_DIR
        const resolved = path.resolve(storagePath);
        if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) {
            return err(res, "Invalid filename", 400);
        }

        fs.writeFileSync(storagePath, buffer);

        return ok(res, {
            attachment: {
                originalName: sanitized,
                storageName: unique,
                storageKey: unique,   // relative key — never expose absolute path
                mimeType,
                sizeBytes: buffer.length,
                uploadedAt: new Date(),
            },
        }, 201);
    } catch (e) {
        return err(res, e.message, 500);
    }
};

/**
 * Download attachment.
 * Authorization: requester must have a mailbox entry for the parent message.
 */
export const downloadAttachment = async (req, res) => {
    try {
        const userId = getUserId(req);
        const { messageId, attachmentId } = req.params;

        // Auth: user must have access to the message
        const message = await zmailService.getMessage({ userId, messageId });

        // Find the specific attachment
        const attachment = message.attachments?.find(
            a => a._id?.toString() === attachmentId
        );
        if (!attachment) {
            return err(res, "Attachment not found", 404);
        }

        // Resolve storage key to absolute path
        const filePath = path.join(UPLOAD_DIR, attachment.storageKey);
        const resolved = path.resolve(filePath);

        // Path traversal prevention
        if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) {
            console.error(`[ZMAIL SECURITY] Path traversal attempt: userId=${userId} storageKey=${attachment.storageKey}`);
            return err(res, "Access denied", 403);
        }

        if (!fs.existsSync(resolved)) {
            return err(res, "Attachment file not found", 404);
        }

        res.setHeader("Content-Type", attachment.mimeType || "application/octet-stream");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${attachment.originalName.replace(/"/g, "'")}"`
        );
        res.setHeader("Content-Length", attachment.sizeBytes);
        res.setHeader("X-Content-Type-Options", "nosniff");

        const stream = fs.createReadStream(resolved);
        stream.pipe(res);
    } catch (e) {
        const status = e.message.includes("access denied") || e.message.includes("not found") ? 404 : 500;
        return err(res, e.message, status);
    }
};

// ─── Admin: trigger backfill ──────────────────────────────────────────────────

export const triggerBackfill = async (req, res) => {
    try {
        const { backfillAllUsers } = await import("../Services/zmail/zmailIdentity.service.js");
        const results = await backfillAllUsers();
        return ok(res, { backfill: results });
    } catch (e) {
        return err(res, e.message, 500);
    }
};
