/**
 * Support Ticket Service — Core business logic
 *
 * Handles:
 *   - Ticket creation (with ZMail thread creation)
 *   - Ticket queries (list, detail, stats)
 *   - Status transitions
 *   - Assignment
 *   - User reply (appends to ZMail thread)
 *   - Support reply (sends from support@zeroleak.com)
 *   - Internal notes (private, never sent via ZMail)
 *   - Audit history
 */

import mongoose from "mongoose";
import {
    SupportTicket,
    generateTicketNumber,
    TICKET_STATUSES,
} from "../../models/supportTicket.models.js";
import { SupportTicketHistory } from "../../models/supportTicketHistory.models.js";
import { SupportInternalNote } from "../../models/supportInternalNote.models.js";
import { ZMailAccount } from "../../models/zmail/zmailAccount.models.js";
import { ZMailThread } from "../../models/zmail/zmailThread.models.js";
import { ZMailMessage } from "../../models/zmail/zmailMessage.models.js";
import { ZMailMailboxEntry } from "../../models/zmail/zmailMailboxEntry.models.js";

/**
 * Safely upsert a mailbox entry. Uses findOneAndUpdate with upsert=true so
 * that a duplicate (userId, messageId) pair never throws E11000.
 */
async function upsertMailboxEntry(data) {
    const { userId, messageId, threadId, folder, isRead } = data;
    const entry = await ZMailMailboxEntry.findOneAndUpdate(
        { userId, messageId },
        { $setOnInsert: { userId, messageId, threadId, folder, isRead } },
        { upsert: true, returnDocument: 'after' }
    );
    if (!isRead) {
        await invalidateUserUnread(userId);
    }
    return entry;
}
import {
    SUPPORT_SYSTEM_ID,
    SUPPORT_EMAIL,
    SUPPORT_DISPLAY_NAME,
    getSupportAccount,
} from "./supportIdentity.service.js";
import { ensureZMailAccount } from "../zmail/zmailIdentity.service.js";
import redisClient from "../../redis/index.js";
import { analyzeSupportTicket } from "../ai/ai.service.js";

const PAGE_SIZE = 20;
const SUPPORT_CACHE_PREFIX = "support:";

// ─── Redis helpers ─────────────────────────────────────────────────────────────
const redisOK = () => redisClient?.isOpen;

async function invalidateUserUnread(userId) {
    if (!redisOK()) return;
    try { await redisClient.del(`zmail:unread:${userId}`); } catch { /* ignore */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSnippet(text, max = 200) {
    return (text || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function buildSubject(ticket) {
    return `[Support #${ticket.ticketNumber}] ${ticket.title}`;
}

/**
 * Build the initial ZMail message body for a new support ticket.
 */
function buildInitialMessageBody(ticket) {
    return [
        `Support Ticket: ${ticket.ticketNumber}`,
        `Title: ${ticket.title}`,
        `Category: ${ticket.category.replace(/_/g, " ")}`,
        `Priority: ${ticket.reportedPriority}`,
        ``,
        `--- Description ---`,
        ticket.description,
        ``,
        `--- Context ---`,
        `Role: ${ticket.reporterRole}`,
        `Submitted: ${new Date().toISOString()}`,
    ].filter(Boolean).join("\n");
}

async function recordHistory(ticketId, ticketNumber, event, actorId, actorRole, actorName, metadata = {}) {
    try {
        await SupportTicketHistory.create({
            ticketId, ticketNumber, event, actorId, actorRole, actorName, metadata,
        });
    } catch (err) {
        console.warn("[SUPPORT] Failed to write history:", err.message);
    }
}

// ─── Valid status transitions ──────────────────────────────────────────────────
const ALLOWED_TRANSITIONS = {
    OPEN: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
    IN_PROGRESS: ["WAITING_FOR_USER", "WAITING_FOR_SUPPORT", "RESOLVED", "CLOSED"],
    WAITING_FOR_USER: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
    WAITING_FOR_SUPPORT: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
    RESOLVED: ["OPEN", "CLOSED"],
    CLOSED: ["OPEN"],
};

function validateTransition(from, to) {
    if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
        throw new Error(`Invalid status transition: ${from} → ${to}`);
    }
}

// ─── Ticket Creation ──────────────────────────────────────────────────────────

/**
 * Create a new support ticket and a linked ZMail conversation.
 *
 * @param {{ reporterId, reporterRole, reporterEmail, reporterName,
 *            title, description, category, reportedPriority,
 *            sourceRoute, metadata, relatedExamId, relatedSessionId,
 *            idempotencyKey }} params
 * @returns {Promise<{ticket, zmailThread}>}
 */
export async function createTicket(params) {
    const {
        reporterId, reporterRole, reporterEmail, reporterName,
        title, description, category, reportedPriority = "normal",
        sourceRoute = "", metadata = {},
        relatedExamId, relatedSessionId,
        idempotencyKey,
    } = params;

    // Idempotency check — prevent duplicate submissions
    if (idempotencyKey) {
        const dup = await SupportTicket.findOne({ idempotencyKey }).lean();
        if (dup) return { ticket: dup, duplicate: true };
    }

    // Ensure the reporter has a ZMail account
    const reporterAccount = await ensureZMailAccount({
        userId: reporterId,
        userType: reporterRole,
        displayName: reporterName,
        loginEmail: reporterEmail
    });

    // Get the support mailbox
    const supportAccount = await getSupportAccount();
    if (!supportAccount) {
        throw new Error("Support mailbox is not provisioned. Contact the administrator.");
    }

    // Generate a safe sequential ticket number
    const ticketNumber = await generateTicketNumber();
    const subject = buildSubject({ ticketNumber, title });

    // Create ZMail thread first
    const thread = await ZMailThread.create({
        subject,
        participantIds: [reporterAccount.userId, SUPPORT_SYSTEM_ID],
        participantAddresses: [reporterAccount.zmailAddress, SUPPORT_EMAIL],
        latestMessageAt: new Date(),
        messageCount: 1,
        snippet: makeSnippet(description),
        hasAttachment: false,
    });

    // Create the initial ZMail message (from reporter to support)
    const body = buildInitialMessageBody({
        ticketNumber, title, description, category,
        reportedPriority, reporterRole, sourceRoute, metadata,
    });

    const message = await ZMailMessage.create({
        threadId: thread._id,
        senderUserId: reporterId,
        senderAddress: reporterAccount.zmailAddress,
        senderName: reporterName,
        to: [{ userId: SUPPORT_SYSTEM_ID, address: SUPPORT_EMAIL, name: SUPPORT_DISPLAY_NAME }],
        cc: [],
        bcc: [],
        subject,
        body,
        attachments: [],
        isDraft: false,
        sentAt: new Date(),
    });

    // Update thread with latest message pointer
    await ZMailThread.updateOne({ _id: thread._id }, {
        latestMessageId: message._id,
        latestMessageAt: message.sentAt,
    });

    // Create mailbox entries
    // Reporter gets a "sent" entry
    await upsertMailboxEntry({
        userId: reporterId,
        messageId: message._id,
        threadId: thread._id,
        folder: "sent",
        isRead: true,
    });

    // Support mailbox gets an "inbox" entry (keyed on SUPPORT_SYSTEM_ID)
    await upsertMailboxEntry({
        userId: SUPPORT_SYSTEM_ID,
        messageId: message._id,
        threadId: thread._id,
        folder: "inbox",
        isRead: false,
    });

    // Create the SupportTicket record
    const ticket = await SupportTicket.create({
        ticketNumber,
        reporterUserId: reporterId,
        reporterRole,
        reporterEmail,
        reporterName,
        zmailThreadId: thread._id,
        initialMessageId: message._id,
        title,
        description,
        category,
        reportedPriority,
        supportPriority: "normal",
        status: "OPEN",
        sourceRoute,
        metadata,
        relatedExamId: relatedExamId || null,
        relatedSessionId: relatedSessionId || null,
        lastMessageAt: new Date(),
        lastCustomerMessageAt: new Date(),
        hasUnreadUserMessage: true,
        idempotencyKey: idempotencyKey || null,
    });

    // Audit log
    await recordHistory(
        ticket._id, ticketNumber, "created",
        reporterId, reporterRole, reporterName,
        { category, reportedPriority }
    );

    // ── Automated Acknowledgment ZMail ──
    const autoReplyBody = `Hello ${reporterName},

Thank you for reaching out to ZeroLeak Support. 

We have successfully received your request regarding "${title}" and have assigned it ticket number: ${ticketNumber}. 

Our AI Support Agent is currently categorizing and prioritizing your issue. A human support agent will review it and get back to you as soon as possible.

You can reply directly to this email to provide any additional details, screenshots, or context.

Best regards,
ZeroLeak Support Team
`;

    const autoReplyMessage = await ZMailMessage.create({
        threadId: thread._id,
        senderUserId: SUPPORT_SYSTEM_ID,
        senderAddress: SUPPORT_EMAIL,
        senderName: SUPPORT_DISPLAY_NAME,
        to: [{ userId: reporterId, address: reporterAccount.zmailAddress, name: reporterName }],
        cc: [],
        bcc: [],
        subject: `Re: ${subject}`,
        body: autoReplyBody,
        attachments: [],
        isDraft: false,
        sentAt: new Date(),
    });

    // Update thread to point to auto-reply as latest message
    await ZMailThread.updateOne({ _id: thread._id }, {
        latestMessageId: autoReplyMessage._id,
        latestMessageAt: autoReplyMessage.sentAt,
    });

    // Add auto-reply to Reporter's inbox (so they get a notification)
    await upsertMailboxEntry({
        userId: reporterId,
        messageId: autoReplyMessage._id,
        threadId: thread._id,
        folder: "inbox",
        isRead: false,
    });

    // Add auto-reply to Support's sent box
    await upsertMailboxEntry({
        userId: SUPPORT_SYSTEM_ID,
        messageId: autoReplyMessage._id,
        threadId: thread._id,
        folder: "sent",
        isRead: true,
    });

    // Update ticket to reflect Support sent a message
    await SupportTicket.updateOne(
        { _id: ticket._id },
        {
            lastSupportMessageAt: new Date(),
            lastMessageAt: new Date(),
        }
    );


    // Fire AI Analysis in the background
    analyzeSupportTicket(title, description, reporterRole).then(async (aiResult) => {
        if (aiResult.success && aiResult.data) {
            const { category: aiCategory, supportPriority: aiPriority, suggestedReply, confidence } = aiResult.data;
            await SupportTicket.updateOne(
                { _id: ticket._id },
                {
                    $set: {
                        category: aiCategory || ticket.category,
                        supportPriority: aiPriority || ticket.supportPriority,
                        aiSuggestedReply: suggestedReply || null,
                        aiConfidence: confidence || null,
                        aiRouted: true
                    }
                }
            );

            // Log AI route history
            await recordHistory(
                ticket._id, ticketNumber, "ai_routed",
                "SYSTEM", "SYSTEM", "AI Support Agent",
                { aiCategory, aiPriority, confidence }
            );

            // Optional: Invalidate cache for support dashboard so the new priority/category appears instantly
            if (redisClient?.isOpen) {
                const keys = await redisClient.keys(`${SUPPORT_CACHE_PREFIX}*`);
                if (keys.length > 0) await redisClient.del(keys);
            }
        }
    }).catch(err => {
        console.error("[Support AI] Failed to analyze ticket:", err.message);
    });

    return { ticket, thread, message };
}

// ─── User Reply ───────────────────────────────────────────────────────────────

/**
 * A user replies to their own support ticket through ZMail.
 */
export async function userReply({ ticketId, senderId, senderRole, senderName, body }) {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) throw new Error("Ticket not found.");
    if (ticket.reporterUserId.toString() !== senderId.toString()) {
        throw new Error("You do not have access to this ticket.");
    }
    if (ticket.status === "CLOSED") {
        // Reopen if closed
        ticket.status = "OPEN";
    }

    const reporterAccount = await ZMailAccount.findOne({ userId: senderId }).lean();
    const supportAccount = await getSupportAccount();

    const thread = await ZMailThread.findById(ticket.zmailThreadId);
    if (!thread) throw new Error("Support thread not found.");

    const subject = thread.subject;

    const message = await ZMailMessage.create({
        threadId: thread._id,
        senderUserId: senderId,
        senderAddress: reporterAccount.zmailAddress,
        senderName,
        to: [{ userId: SUPPORT_SYSTEM_ID, address: SUPPORT_EMAIL, name: SUPPORT_DISPLAY_NAME }],
        cc: [],
        bcc: [],
        subject,
        body,
        attachments: [],
        isDraft: false,
        sentAt: new Date(),
        replyToMessageId: thread.latestMessageId,
    });

    await ZMailThread.updateOne({ _id: thread._id }, {
        latestMessageId: message._id,
        latestMessageAt: message.sentAt,
        snippet: makeSnippet(body),
        $inc: { messageCount: 1 },
    });

    // Reporter sent entry
    await upsertMailboxEntry({
        userId: senderId,
        messageId: message._id,
        threadId: thread._id,
        folder: "sent",
        isRead: true,
    });

    // Support inbox entry
    await upsertMailboxEntry({
        userId: SUPPORT_SYSTEM_ID,
        messageId: message._id,
        threadId: thread._id,
        folder: "inbox",
        isRead: false,
    });

    // Update ticket metadata
    const now = new Date();
    ticket.lastMessageAt = now;
    ticket.lastCustomerMessageAt = now;
    ticket.hasUnreadUserMessage = true;
    if (ticket.status === "WAITING_FOR_USER") {
        ticket.status = "WAITING_FOR_SUPPORT";
    }
    await ticket.save();

    await recordHistory(
        ticket._id, ticket.ticketNumber, "user_reply",
        senderId, senderRole, senderName, {}
    );

    return { message, ticket };
}

// ─── Support Reply ────────────────────────────────────────────────────────────

/**
 * A support agent replies to a ticket. Message sent as support@zeroleak.com.
 */
export async function supportReply({ ticketId, agentId, agentName, agentRole, body }) {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) throw new Error("Ticket not found.");
    if (ticket.status === "CLOSED") {
        throw new Error("Cannot reply to a closed ticket. Reopen it first.");
    }

    const supportAccount = await getSupportAccount();
    const reporterAccount = await ZMailAccount.findOne({ userId: ticket.reporterUserId }).lean();
    if (!reporterAccount) throw new Error("Reporter ZMail account not found.");

    const thread = await ZMailThread.findById(ticket.zmailThreadId);
    if (!thread) throw new Error("Support thread not found.");

    const message = await ZMailMessage.create({
        threadId: thread._id,
        senderUserId: SUPPORT_SYSTEM_ID,
        senderAddress: SUPPORT_EMAIL,
        senderName: SUPPORT_DISPLAY_NAME,
        to: [{ userId: ticket.reporterUserId, address: reporterAccount.zmailAddress, name: ticket.reporterName }],
        cc: [],
        bcc: [],
        subject: thread.subject,
        body,
        attachments: [],
        isDraft: false,
        sentAt: new Date(),
        replyToMessageId: thread.latestMessageId,
    });

    await ZMailThread.updateOne({ _id: thread._id }, {
        latestMessageId: message._id,
        latestMessageAt: message.sentAt,
        snippet: makeSnippet(body),
        $inc: { messageCount: 1 },
    });

    // Reporter gets inbox entry (they receive the reply)
    await upsertMailboxEntry({
        userId: ticket.reporterUserId,
        messageId: message._id,
        threadId: thread._id,
        folder: "inbox",
        isRead: false,
    });

    // Support sent entry
    await upsertMailboxEntry({
        userId: SUPPORT_SYSTEM_ID,
        messageId: message._id,
        threadId: thread._id,
        folder: "sent",
        isRead: true,
    });

    // Invalidate reporter's unread cache so new message appears
    await invalidateUserUnread(ticket.reporterUserId);

    const now = new Date();
    ticket.lastMessageAt = now;
    ticket.lastSupportMessageAt = now;
    ticket.hasUnreadUserMessage = false;
    if (ticket.status === "OPEN" || ticket.status === "WAITING_FOR_SUPPORT") {
        ticket.status = "WAITING_FOR_USER";
    }
    await ticket.save();

    await recordHistory(
        ticket._id, ticket.ticketNumber, "support_reply",
        agentId, agentRole, agentName, {}
    );

    return { message, ticket };
}

// ─── Status management ────────────────────────────────────────────────────────

export async function changeStatus({ ticketId, newStatus, agentId, agentRole, agentName }) {
    if (!TICKET_STATUSES.includes(newStatus)) {
        throw new Error(`Invalid status: ${newStatus}`);
    }
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) throw new Error("Ticket not found.");

    const oldStatus = ticket.status;
    validateTransition(oldStatus, newStatus);

    ticket.status = newStatus;
    const now = new Date();
    if (newStatus === "RESOLVED") ticket.resolvedAt = now;
    if (newStatus === "CLOSED") ticket.closedAt = now;
    if (newStatus === "OPEN") { ticket.resolvedAt = null; ticket.closedAt = null; }
    await ticket.save();

    await recordHistory(ticket._id, ticket.ticketNumber, "status_changed",
        agentId, agentRole, agentName, { from: oldStatus, to: newStatus });

    if (newStatus === "RESOLVED" && oldStatus !== "RESOLVED") {
        try {
            const body = `Hello ${ticket.reporterName},\n\nYour support ticket #${ticket.ticketNumber} ("${ticket.title}") has been marked as RESOLVED by ${agentName}.\n\nIf you have any further questions or if the issue persists, please reply to this thread to reopen the ticket.`;
            await supportReply({
                ticketId: ticket._id,
                agentId,
                agentName: "ZeroLeak Support",
                agentRole: "system",
                body
            });
        } catch (err) {
            console.error("[SUPPORT] Failed to send resolution notification:", err.message);
        }
    }

    return ticket;
}

// ─── Assignment ───────────────────────────────────────────────────────────────

export async function assignTicket({ ticketId, assignToId, assignedById, assignedByRole, assignedByName }) {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) throw new Error("Ticket not found.");

    const wasAssigned = ticket.assignedTo;
    const event = wasAssigned ? "reassigned" : "assigned";

    ticket.assignedTo = assignToId || null;
    ticket.assignedAt = assignToId ? new Date() : null;
    ticket.assignedBy = assignedById;
    await ticket.save();

    await recordHistory(ticket._id, ticket.ticketNumber, event,
        assignedById, assignedByRole, assignedByName,
        { from: wasAssigned?.toString(), to: assignToId?.toString() });

    return ticket;
}

// ─── Priority management ──────────────────────────────────────────────────────

export async function setSupportPriority({ ticketId, priority, agentId, agentRole, agentName }) {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) throw new Error("Ticket not found.");

    const old = ticket.supportPriority;
    ticket.supportPriority = priority;
    await ticket.save();

    await recordHistory(ticket._id, ticket.ticketNumber, "priority_changed",
        agentId, agentRole, agentName, { from: old, to: priority });

    return ticket;
}

// ─── Internal Notes ───────────────────────────────────────────────────────────

export async function addInternalNote({ ticketId, authorId, authorName, content }) {
    const ticket = await SupportTicket.findById(ticketId).lean();
    if (!ticket) throw new Error("Ticket not found.");

    const note = await SupportInternalNote.create({
        ticketId,
        ticketNumber: ticket.ticketNumber,
        authorId,
        authorName,
        content,
    });

    await recordHistory(ticketId, ticket.ticketNumber, "internal_note_added",
        authorId, "Support", authorName, {});

    return note;
}

export async function getInternalNotes(ticketId) {
    return SupportInternalNote.find({ ticketId }).sort({ createdAt: 1 }).lean();
}

// ─── Ticket queries ───────────────────────────────────────────────────────────

export async function getTicketById(ticketId) {
    return SupportTicket.findById(ticketId).lean();
}

export async function getTicketByNumber(ticketNumber) {
    return SupportTicket.findOne({ ticketNumber }).lean();
}

/**
 * Support dashboard: list tickets with filters, pagination, sorting.
 */
export async function listTickets({
    status, priority, category, assignedTo, reporterRole,
    search, page = 1, limit = PAGE_SIZE, sort = "lastMessageAt",
}) {
    const filter = {};
    if (status) {
        if (status.includes(",")) filter.status = { $in: status.split(",") };
        else filter.status = status;
    }
    if (priority) filter.supportPriority = priority;
    if (category) filter.category = category;
    if (assignedTo === "unassigned") filter.assignedTo = null;
    else if (assignedTo) filter.assignedTo = assignedTo;
    if (reporterRole) filter.reporterRole = reporterRole;

    if (search) {
        const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filter.$or = [
            { ticketNumber: re },
            { title: re },
            { reporterName: re },
            { reporterEmail: re },
        ];
    }

    const sortObj = sort === "priority"
        ? { supportPriority: -1, lastMessageAt: -1 }
        : sort === "oldest"
            ? { createdAt: 1 }
            : { lastMessageAt: -1 };

    const skip = (page - 1) * limit;
    const [tickets, total] = await Promise.all([
        SupportTicket.find(filter)
            .select("ticketNumber title reporterName reporterEmail reporterRole category supportPriority status assignedTo lastMessageAt hasUnreadUserMessage createdAt")
            .sort(sortObj)
            .skip(skip)
            .limit(limit)
            .lean(),
        SupportTicket.countDocuments(filter),
    ]);

    return { tickets, total, page, pages: Math.ceil(total / limit) };
}

/**
 * User-facing: list only the requesting user's own tickets.
 */
export async function listMyTickets({ reporterId, page = 1, limit = PAGE_SIZE }) {
    const skip = (page - 1) * limit;
    const [tickets, total] = await Promise.all([
        SupportTicket.find({ reporterUserId: reporterId })
            .select("ticketNumber title category reportedPriority status lastMessageAt createdAt")
            .sort({ lastMessageAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        SupportTicket.countDocuments({ reporterUserId: reporterId }),
    ]);
    return { tickets, total, page, pages: Math.ceil(total / limit) };
}

/**
 * Dashboard stats via a single aggregation.
 */
export async function getStats() {
    const [statusCounts, urgentCount, unassignedCount] = await Promise.all([
        SupportTicket.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        SupportTicket.countDocuments({
            supportPriority: "urgent",
            status: { $nin: ["RESOLVED", "CLOSED"] },
        }),
        SupportTicket.countDocuments({
            assignedTo: null,
            status: { $nin: ["RESOLVED", "CLOSED"] },
        }),
    ]);

    const statusMap = {};
    for (const { _id, count } of statusCounts) statusMap[_id] = count;

    return {
        open: statusMap["OPEN"] || 0,
        inProgress: statusMap["IN_PROGRESS"] || 0,
        waitingForUser: statusMap["WAITING_FOR_USER"] || 0,
        waitingForSupport: statusMap["WAITING_FOR_SUPPORT"] || 0,
        resolved: statusMap["RESOLVED"] || 0,
        closed: statusMap["CLOSED"] || 0,
        urgent: urgentCount,
        unassigned: unassignedCount,
    };
}

/**
 * Get full conversation for a ticket (messages from the ZMail thread).
 */
export async function getTicketConversation(ticketId, requesterId, requesterIsSupport) {
    const ticket = await SupportTicket.findById(ticketId).lean();
    if (!ticket) throw new Error("Ticket not found.");

    // Authorization check
    if (!requesterIsSupport && ticket.reporterUserId.toString() !== requesterId.toString()) {
        throw new Error("Forbidden: you do not have access to this ticket.");
    }

    const messages = await ZMailMessage.find({ threadId: ticket.zmailThreadId })
        .select("senderAddress senderName body sentAt attachments replyToMessageId")
        .sort({ sentAt: 1 })
        .lean();

    return { ticket, messages };
}

export async function getTicketHistory(ticketId) {
    return SupportTicketHistory.find({ ticketId }).sort({ createdAt: 1 }).lean();
}

export async function getGlobalTicketHistory({ page = 1, limit = 50 }) {
    const skip = (page - 1) * limit;
    const [history, total] = await Promise.all([
        SupportTicketHistory.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        SupportTicketHistory.countDocuments({}),
    ]);
    return { history, total, page, pages: Math.ceil(total / limit) };
}
