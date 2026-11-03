/**
 * Support Controller
 *
 * Thin controller layer. Business logic lives in support.service.js.
 * Authentication context is derived from req.user (set by middleware).
 * Client-supplied identity fields are IGNORED.
 */

import * as supportService from "../Services/support/support.service.js";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from "../models/supportTicket.models.js";
import { getSupportSocketNamespace } from "../sockets/support.socket.js";
import { getZMailNamespace } from "../sockets/zmail.socket.js";
import jwt from "jsonwebtoken";
import { SUPPORT_SYSTEM_ID } from "../Services/support/supportIdentity.service.js";
import { Admin } from "../models/admin.models.js";
import { AuditLog } from "../models/auditlog.models.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActorInfo(req) {
    const u = req.user || req.admin || req.professor || req.student || req.auditor;
    const role = req.userRole || "Unknown";
    const name = u?.name || u?.email?.split("@")[0] || "User";
    const email = u?.email || "";
    return { id: u?._id, role, name, email };
}

function ok(res, data, status = 200) {
    return res.status(status).json({ success: true, ...data });
}
function err(res, message, status = 400) {
    return res.status(status).json({ success: false, error: message });
}

// ─── Constants ─────────────────────────────────────────────────────────────────

export const getConstants = async (req, res) => {
    return ok(res, {
        categories: TICKET_CATEGORIES,
        priorities: TICKET_PRIORITIES,
        statuses: TICKET_STATUSES,
    });
};

// ─── User endpoints ───────────────────────────────────────────────────────────

/**
 * POST /api/support/tickets
 * Any authenticated user submits a new support ticket.
 */
export const createTicket = async (req, res) => {
    try {
        const actor = getActorInfo(req);
        if (!actor.id) return err(res, "Unauthorized", 401);

        const {
            title, description, category, reportedPriority,
            sourceRoute, metadata, relatedExamId, relatedSessionId,
            idempotencyKey,
        } = req.body;

        if (!title?.trim())       return err(res, "Title is required.");
        if (!description?.trim()) return err(res, "Description is required.");
        if (!category)            return err(res, "Category is required.");
        if (!TICKET_CATEGORIES.includes(category)) return err(res, "Invalid category.");

        const result = await supportService.createTicket({
            reporterId: actor.id,
            reporterRole: actor.role,
            reporterEmail: actor.email,
            reporterName: actor.name,
            title: title.trim(),
            description: description.trim(),
            category,
            reportedPriority: TICKET_PRIORITIES.includes(reportedPriority) ? reportedPriority : "normal",
            sourceRoute: sourceRoute || "",
            metadata: metadata || {},
            relatedExamId: relatedExamId || null,
            relatedSessionId: relatedSessionId || null,
            idempotencyKey: idempotencyKey || null,
        });

        // Notify support team via Socket.IO
        try {
            const supportNs = getSupportSocketNamespace();
            if (supportNs) {
                supportNs.to("support:team").emit("support:new-ticket", {
                    ticketId: result.ticket._id,
                    ticketNumber: result.ticket.ticketNumber,
                    title: result.ticket.title,
                    reporterName: actor.name,
                    reporterRole: actor.role,
                    category,
                    priority: result.ticket.reportedPriority,
                    createdAt: result.ticket.createdAt,
                });
            }
        } catch { /* non-fatal */ }

        return ok(res, { ticket: result.ticket, duplicate: result.duplicate || false }, 201);
    } catch (e) {
        console.error("[SUPPORT] createTicket error:", e.message);
        return err(res, e.message);
    }
};

/**
 * GET /api/support/my-tickets
 */
export const getMyTickets = async (req, res) => {
    try {
        const actor = getActorInfo(req);
        const page = parseInt(req.query.page) || 1;
        const result = await supportService.listMyTickets({ reporterId: actor.id, page });
        return ok(res, result);
    } catch (e) {
        return err(res, e.message);
    }
};

/**
 * GET /api/support/my-tickets/:ticketId
 */
export const getMyTicket = async (req, res) => {
    try {
        const actor = getActorInfo(req);
        const { ticket, messages } = await supportService.getTicketConversation(
            req.params.ticketId, actor.id, false
        );
        return ok(res, { ticket, messages });
    } catch (e) {
        return err(res, e.message, e.message.includes("Forbidden") ? 403 : 400);
    }
};

/**
 * POST /api/support/my-tickets/:ticketId/reply
 */
export const userReply = async (req, res) => {
    try {
        const actor = getActorInfo(req);
        const { body } = req.body;
        if (!body?.trim()) return err(res, "Reply body is required.");

        const { message, ticket } = await supportService.userReply({
            ticketId: req.params.ticketId,
            senderId: actor.id,
            senderRole: actor.role,
            senderName: actor.name,
            body: body.trim(),
        });

        // Notify support team
        try {
            const supportNs = getSupportSocketNamespace();
            if (supportNs) {
                supportNs.to("support:team").emit("support:ticket-updated", {
                    ticketId: ticket._id,
                    ticketNumber: ticket.ticketNumber,
                    event: "user_reply",
                });
            }
        } catch { /* non-fatal */ }

        return ok(res, { message, ticket });
    } catch (e) {
        return err(res, e.message, e.message.includes("Forbidden") ? 403 : 400);
    }
};

// ─── Support team endpoints ───────────────────────────────────────────────────

/**
 * GET /api/support/tickets
 */
export const listTickets = async (req, res) => {
    try {
        const { status, priority, category, assignedTo, reporterRole, search, page, sort } = req.query;
        const result = await supportService.listTickets({
            status, priority, category, assignedTo, reporterRole,
            search, page: parseInt(page) || 1, sort,
        });
        return ok(res, result);
    } catch (e) {
        return err(res, e.message);
    }
};

/**
 * GET /api/support/tickets/:ticketId
 */
export const getTicket = async (req, res) => {
    try {
        const actor = getActorInfo(req);
        const { ticket, messages } = await supportService.getTicketConversation(
            req.params.ticketId, actor.id, true
        );
        return ok(res, { ticket, messages });
    } catch (e) {
        return err(res, e.message, e.message.includes("Forbidden") ? 403 : 400);
    }
};

/**
 * PATCH /api/support/tickets/:ticketId/status
 */
export const changeStatus = async (req, res) => {
    try {
        const actor = getActorInfo(req);
        const { status } = req.body;
        if (!status) return err(res, "Status is required.");

        const ticket = await supportService.changeStatus({
            ticketId: req.params.ticketId,
            newStatus: status,
            agentId: actor.id,
            agentRole: actor.role,
            agentName: actor.name,
        });

        notifySupportUpdate(ticket, "status_changed");
        return ok(res, { ticket });
    } catch (e) {
        return err(res, e.message);
    }
};

/**
 * PATCH /api/support/tickets/:ticketId/priority
 */
export const changePriority = async (req, res) => {
    try {
        const actor = getActorInfo(req);
        const { priority } = req.body;
        if (!TICKET_PRIORITIES.includes(priority)) return err(res, "Invalid priority.");

        const ticket = await supportService.setSupportPriority({
            ticketId: req.params.ticketId,
            priority,
            agentId: actor.id,
            agentRole: actor.role,
            agentName: actor.name,
        });
        return ok(res, { ticket });
    } catch (e) {
        return err(res, e.message);
    }
};

/**
 * PATCH /api/support/tickets/:ticketId/assign
 */
export const assignTicket = async (req, res) => {
    try {
        const actor = getActorInfo(req);
        const { assignToId } = req.body; // null = unassign

        const ticket = await supportService.assignTicket({
            ticketId: req.params.ticketId,
            assignToId: assignToId || null,
            assignedById: actor.id,
            assignedByRole: actor.role,
            assignedByName: actor.name,
        });
        notifySupportUpdate(ticket, "assigned");
        return ok(res, { ticket });
    } catch (e) {
        return err(res, e.message);
    }
};

/**
 * POST /api/support/tickets/:ticketId/reply
 * Support agent replies (sends as support@zeroleak.com via ZMail).
 */
export const supportReply = async (req, res) => {
    try {
        const actor = getActorInfo(req);
        const { body } = req.body;
        if (!body?.trim()) return err(res, "Reply body is required.");

        const { message, ticket } = await supportService.supportReply({
            ticketId: req.params.ticketId,
            agentId: actor.id,
            agentName: actor.name,
            agentRole: actor.role,
            body: body.trim(),
        });

        // Notify the reporter via the ZMail socket room
        try {
            const zmailNs = getZMailNamespace();
            if (zmailNs) {
                zmailNs.to(`zmail:user:${ticket.reporterUserId}`).emit("zmail:new-message", {
                    messageId: message._id,
                    threadId: ticket.zmailThreadId,
                    senderName: "ZeroLeak Support",
                    senderAddress: "support@zeroleak.com",
                    subject: `[Support #${ticket.ticketNumber}] ${ticket.title}`,
                    snippet: (body || "").slice(0, 120),
                    sentAt: message.sentAt,
                    hasAttachment: false,
                });
                zmailNs.to(`zmail:user:${ticket.reporterUserId}`).emit("zmail:unread-count-bump");
            }
        } catch { /* non-fatal */ }

        notifySupportUpdate(ticket, "support_reply");
        return ok(res, { message, ticket });
    } catch (e) {
        return err(res, e.message);
    }
};

/**
 * POST /api/support/tickets/:ticketId/notes
 */
export const addInternalNote = async (req, res) => {
    try {
        const actor = getActorInfo(req);
        const { content } = req.body;
        if (!content?.trim()) return err(res, "Note content is required.");

        const note = await supportService.addInternalNote({
            ticketId: req.params.ticketId,
            authorId: actor.id,
            authorName: actor.name,
            content: content.trim(),
        });
        return ok(res, { note }, 201);
    } catch (e) {
        return err(res, e.message);
    }
};

/**
 * GET /api/support/tickets/:ticketId/notes
 */
export const getInternalNotes = async (req, res) => {
    try {
        const notes = await supportService.getInternalNotes(req.params.ticketId);
        return ok(res, { notes });
    } catch (e) {
        return err(res, e.message);
    }
};

/**
 * GET /api/support/tickets/:ticketId/history
 */
export const getTicketHistory = async (req, res) => {
    try {
        const history = await supportService.getTicketHistory(req.params.ticketId);
        return ok(res, { history });
    } catch (e) {
        return err(res, e.message);
    }
};

/**
 * GET /api/support/global-history
 */
export const getGlobalHistory = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const result = await supportService.getGlobalTicketHistory({ page, limit });
        return ok(res, result);
    } catch (e) {
        return err(res, e.message);
    }
};

/**
 * GET /api/support/stats
 */
export const getStats = async (req, res) => {
    try {
        const stats = await supportService.getStats();
        return ok(res, { stats });
    } catch (e) {
        return err(res, e.message);
    }
};

// ─── Helper: emit realtime update to support team ─────────────────────────────
function notifySupportUpdate(ticket, event) {
    try {
        const supportNs = getSupportSocketNamespace();
        if (supportNs) {
            supportNs.to("support:team").emit("support:ticket-updated", {
                ticketId: ticket._id,
                ticketNumber: ticket.ticketNumber,
                status: ticket.status,
                event,
            });
        }
    } catch { /* non-fatal */ }
}

// ─── AUTH ──────────────────────────────────────────────────────────────────────

export const supportLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await Admin.findOne({ email, isSupport: true });
        if (admin) {
            if (admin.isBlocked) {
                return res.status(403).json({ success: false, message: "Your account is blocked", code: "BLOCKED" });
            }
            const isMatch = await admin.isPasswordCorrect(password);
            if (isMatch) {
                const forceLogout = req.body.forceLogout === true || req.body.forceLogout === "true";
                if (admin.isLoggedIn && !forceLogout) {
                    return res.status(409).json({ message: "You're logged in at some other place too. Wish to continue?", code: "ALREADY_LOGGED_IN" });
                }
                admin.isLoggedIn = true;
                admin.lastActiveAt = new Date();
                admin.sessionVersion = (admin.sessionVersion || 0) + 1;
                await admin.save({ validateBeforeSave: false });

                const token = jwt.sign(
                    { id: admin._id, email: admin.email, role: "SupportAgent", sessionVersion: admin.sessionVersion },
                    process.env.ACCESS_TOKEN_SECRET,
                    { expiresIn: "1d" }
                );
                // Audit Log
                try {
                    await AuditLog.create({
                        actor: admin.email,
                        actorRole: "Support",
                        action: "SUPPORT_LOGIN",
                        targetType: "Admin",
                        targetId: String(admin._id),
                        targetLabel: admin.name || admin.email,
                        status: "success"
                    });
                } catch (auditErr) {
                    console.error("[SUPPORT] AuditLog error:", auditErr.message);
                }

                return res.status(200).json({ success: true, token, user: { name: admin.name, email: admin.email } });
            }
        }
        return res.status(401).json({ success: false, message: "Invalid credentials" });
    } catch (error) {
        console.error("[Support Controller] supportLogin Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

export const updateSupportProfile = async (req, res) => {
    try {
        const { name, password, newPassword } = req.body;
        const admin = await Admin.findById(req.user._id);
        if (!admin) return res.status(404).json({ message: "Support member not found" });

        if (password && newPassword) {
            const isMatch = await admin.isPasswordCorrect(password);
            if (!isMatch) return res.status(400).json({ message: "Incorrect current password" });
            admin.password = newPassword;
            admin.sessionVersion = (admin.sessionVersion || 0) + 1;
        }

        if (name) admin.name = name;
        await admin.save();
        
        const updated = admin.toObject();
        delete updated.password;
        
        return res.status(200).json({ message: "Profile updated successfully", support: updated });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const logoutSupport = async (req, res) => {
    try {
        const adminId = req.user?._id || req.admin?._id;
        const admin = await Admin.findById(adminId);
        if (admin) {
            admin.isLoggedIn = false;
            admin.sessionVersion = (admin.sessionVersion || 0) + 1;
            await admin.save({ validateBeforeSave: false });

            try {
                await AuditLog.create({
                    actor: admin.email,
                    actorRole: "Support",
                    action: "SUPPORT_LOGOUT",
                    targetType: "Admin",
                    targetId: String(admin._id),
                    targetLabel: admin.name || admin.email,
                    status: "success"
                });
            } catch (auditErr) {
                console.error("[SUPPORT] AuditLog error on logout:", auditErr.message);
            }
        }
        return res.status(200).json({ success: true, message: "Logout successful" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Error logging out", error: error.message });
    }
};
