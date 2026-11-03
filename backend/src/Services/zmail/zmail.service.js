/**
 * ZMail Core Service
 *
 * Handles all mail business logic:
 *   - Sending mail
 *   - Inbox / folder queries
 *   - Read / unread state
 *   - Star / important
 *   - Archive / trash / restore / permanent delete
 *   - Threads
 *   - Drafts (with optimistic versioning)
 *   - Search
 *   - Unread count (Redis-cached, MongoDB fallback)
 *   - Real-time notifications via Socket.IO
 */

import mongoose from "mongoose";
import { ZMailAccount } from "../../models/zmail/zmailAccount.models.js";
import { ZMailThread } from "../../models/zmail/zmailThread.models.js";
import { ZMailMessage } from "../../models/zmail/zmailMessage.models.js";
import { ZMailMailboxEntry } from "../../models/zmail/zmailMailboxEntry.models.js";
import { isInternalAddress, resolveAddress } from "./zmailIdentity.service.js";
import redisClient from "../../redis/index.js";

// ─── Configuration ────────────────────────────────────────────────────────────
const MAX_BODY_LENGTH = 204800; // 200 KB
const MAX_SUBJECT_LENGTH = 998;
const MAX_TO_RECIPIENTS = 50;
const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_ATTACHMENTS_PER_MESSAGE = 10;
const UNREAD_CACHE_TTL = 300; // 5 minutes

// ─── Redis helpers ────────────────────────────────────────────────────────────
const redisOK = () => redisClient?.isOpen;
const UNREAD_KEY = (userId) => `zmail:unread:${userId}`;
const DRAFT_KEY = (userId) => `zmail:draft_count:${userId}`;

async function getCachedUnread(userId) {
    if (!redisOK()) return null;
    try {
        const v = await redisClient.get(UNREAD_KEY(userId.toString()));
        return v !== null ? parseInt(v, 10) : null;
    } catch { return null; }
}

async function setCachedUnread(userId, count) {
    if (!redisOK()) return;
    try {
        await redisClient.set(UNREAD_KEY(userId.toString()), count, { EX: UNREAD_CACHE_TTL });
    } catch { /* ignore */ }
}

async function invalidateCachedUnread(userId) {
    if (!redisOK()) return;
    try {
        await redisClient.del(UNREAD_KEY(userId.toString()));
    } catch { /* ignore */ }
}

// ─── Private helpers ──────────────────────────────────────────────────────────
function makeSnippet(body, maxLen = 200) {
    return (body || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Build the base mailbox entry filter for a user's folder view.
 * Excludes permanently deleted entries.
 */
function folderFilter(userId, folder) {
    const base = { userId, isDeleted: false };

    switch (folder) {
        case "inbox":
            return { ...base, folder: "inbox", isTrashed: false, isArchived: false };
        case "sent":
            return { ...base, folder: "sent", isTrashed: false, isArchived: false };
        case "drafts":
            return { ...base, folder: "drafts", isTrashed: false };
        case "starred":
            return { ...base, isStarred: true, isTrashed: false, isArchived: false };
        case "important":
            return { ...base, isImportant: true, isTrashed: false, isArchived: false };
        case "archive":
            return { ...base, isArchived: true, isTrashed: false };
        case "trash":
            return { ...base, isTrashed: true };
        case "all":
            return { ...base, isTrashed: false };
        default:
            return { ...base, isTrashed: false };
    }
}

// ─── Recipient validation ─────────────────────────────────────────────────────

/**
 * Validate and resolve an array of ZMail address strings.
 * Returns resolved ZMailAccount docs or throws.
 * @param {string[]} addresses
 * @returns {Promise<Array<{userId, address, name}>>}
 */
export async function resolveAndValidateRecipients(addresses) {
    if (!Array.isArray(addresses) || addresses.length === 0) {
        throw new Error("At least one recipient is required");
    }
    if (addresses.length > MAX_TO_RECIPIENTS) {
        throw new Error(`Too many recipients (max ${MAX_TO_RECIPIENTS})`);
    }

    const resolved = [];
    for (const addr of addresses) {
        if (!isInternalAddress(addr)) {
            throw new Error(`Invalid or external address: ${addr}. Only @zeroleak.com addresses are accepted.`);
        }
        const account = await resolveAddress(addr);
        if (!account) {
            throw new Error(`Recipient not found: ${addr}`);
        }
        if (account.mailboxStatus !== "active") {
            throw new Error(`Recipient mailbox is not active: ${addr}`);
        }
        resolved.push({ userId: account.userId, address: account.zmailAddress, name: account.displayName });
    }
    return resolved;
}

// ─── Send Mail ────────────────────────────────────────────────────────────────

/**
 * Send a new message.
 * The sender is always taken from the authenticated user's ZMailAccount —
 * the client-supplied sender is IGNORED.
 *
 * @param {{
 *   senderUserId: ObjectId,
 *   to: string[],
 *   cc?: string[],
 *   bcc?: string[],
 *   subject?: string,
 *   body: string,
 *   attachments?: object[],
 *   replyToMessageId?: string,
 *   forwardedFromMessageId?: string,
 *   threadId?: string,
 *   io?: Server,  // socket.io Server for real-time events
 * }} params
 */
export async function sendMail({
    senderUserId,
    to,
    cc = [],
    bcc = [],
    subject,
    body,
    attachments = [],
    replyToMessageId = null,
    forwardedFromMessageId = null,
    existingThreadId = null,
    io = null,
}) {
    // ── 1. Load sender account ────────────────────────────────────────────────
    const senderAccount = await ZMailAccount.findOne({ userId: senderUserId }).lean();
    if (!senderAccount) throw new Error("Your ZeroleakMail account is not provisioned. Please contact an administrator.");
    if (senderAccount.mailboxStatus !== "active") throw new Error("Your ZeroleakMail account is suspended.");

    // ── 2. Validate recipients ────────────────────────────────────────────────
    const resolvedTo  = await resolveAndValidateRecipients(to);
    const resolvedCc  = cc.length  ? await resolveAndValidateRecipients(cc)  : [];
    const resolvedBcc = bcc.length ? await resolveAndValidateRecipients(bcc) : [];

    // ── 3. Validate body / subject ────────────────────────────────────────────
    if (!body || body.trim().length === 0) throw new Error("Message body cannot be empty");
    if (body.length > MAX_BODY_LENGTH) throw new Error("Message body exceeds 200 KB limit");
    const safeSubject = (subject || "(no subject)").trim().slice(0, MAX_SUBJECT_LENGTH);

    // ── 4. Validate attachments ───────────────────────────────────────────────
    if (attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
        throw new Error(`Too many attachments (max ${MAX_ATTACHMENTS_PER_MESSAGE})`);
    }
    for (const att of attachments) {
        if (att.sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
            throw new Error(`Attachment "${att.originalName}" exceeds 25 MB size limit`);
        }
    }

    // ── 5. Resolve / create thread ────────────────────────────────────────────
    let thread;
    if (existingThreadId && isValidObjectId(existingThreadId)) {
        thread = await ZMailThread.findById(existingThreadId);
        if (!thread) throw new Error("Thread not found");
        // Verify sender is a participant in this thread
        const isParticipant = thread.participantIds.some(id => id.toString() === senderUserId.toString());
        if (!isParticipant) throw new Error("You are not a participant in this thread");
    } else {
        // New conversation — create a thread
        thread = new ZMailThread({ subject: safeSubject });
    }

    // ── 6. Collect all participant userIds ────────────────────────────────────
    const allRecipients = [...resolvedTo, ...resolvedCc, ...resolvedBcc];
    const participantUserIds = [...new Set([
        senderAccount.userId.toString(),
        ...allRecipients.map(r => r.userId.toString()),
    ])].map(id => new mongoose.Types.ObjectId(id));
    const participantAddresses = [...new Set([
        senderAccount.zmailAddress,
        ...allRecipients.map(r => r.address),
    ])];

    thread.participantIds = participantUserIds;
    thread.participantAddresses = participantAddresses;

    // ── 7. Create the message document ────────────────────────────────────────
    const message = new ZMailMessage({
        threadId: thread._id,
        senderUserId: senderAccount.userId,
        senderAddress: senderAccount.zmailAddress,
        senderName: senderAccount.displayName,
        to: resolvedTo,
        cc: resolvedCc,
        bcc: resolvedBcc,
        subject: safeSubject,
        body: body.trim(),
        attachments,
        replyToMessageId: (replyToMessageId && isValidObjectId(replyToMessageId)) ? replyToMessageId : null,
        forwardedFromMessageId: (forwardedFromMessageId && isValidObjectId(forwardedFromMessageId)) ? forwardedFromMessageId : null,
        isDraft: false,
        sentAt: new Date(),
    });

    // ── 8. Update thread metadata ─────────────────────────────────────────────
    thread.latestMessageId = message._id;
    thread.latestMessageAt = message.sentAt;
    thread.messageCount = (thread.messageCount || 0) + 1;
    thread.snippet = makeSnippet(body);
    thread.hasAttachment = attachments.length > 0 || thread.hasAttachment;

    // ── 9. Persist thread + message atomically ────────────────────────────────
    await thread.save();
    message.threadId = thread._id; // ensure set if thread was new
    await message.save();

    // ── 10. Create mailbox entries ────────────────────────────────────────────
    const entries = [];

    // Sender gets a "sent" entry
    entries.push({
        userId: senderAccount.userId,
        messageId: message._id,
        threadId: thread._id,
        folder: "sent",
        isRead: true, // sender already read their own message
    });

    // Each recipient (To + CC) gets an "inbox" entry
    // BCC recipients also get inbox entries but their addresses won't appear to others
    const inboxRecipients = [...new Set([
        ...resolvedTo.map(r => r.userId.toString()),
        ...resolvedCc.map(r => r.userId.toString()),
        ...resolvedBcc.map(r => r.userId.toString()),
    ])].filter(id => id !== senderAccount.userId.toString());

    for (const recipientId of inboxRecipients) {
        entries.push({
            userId: new mongoose.Types.ObjectId(recipientId),
            messageId: message._id,
            threadId: thread._id,
            folder: "inbox",
            isRead: false,
        });
    }

    await ZMailMailboxEntry.insertMany(entries);

    // ── 11. Invalidate unread caches for recipients ───────────────────────────
    for (const recipientId of inboxRecipients) {
        await invalidateCachedUnread(recipientId);
    }

    // ── 12. Emit real-time events to recipients ───────────────────────────────
    if (io) {
        const notification = {
            messageId: message._id,
            threadId: thread._id,
            senderName: senderAccount.displayName,
            senderAddress: senderAccount.zmailAddress,
            subject: safeSubject,
            snippet: makeSnippet(body, 120),
            sentAt: message.sentAt,
            hasAttachment: attachments.length > 0,
        };

        for (const recipientId of inboxRecipients) {
            io.to(`zmail:user:${recipientId}`).emit("zmail:new-message", notification);
        }
    }

    return { message, thread };
}

// ─── Mailbox Queries ──────────────────────────────────────────────────────────

/**
 * Get paginated mailbox entries for a folder.
 */
export async function getMailboxFolder({ userId, folder, page = 1, limit = 25 }) {
    const skip = (Math.max(1, page) - 1) * Math.min(100, limit);
    const filter = folderFilter(userId, folder);

    const [entries, total] = await Promise.all([
        ZMailMailboxEntry.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Math.min(100, limit))
            .populate({
                path: "messageId",
                select: "senderAddress senderName subject body sentAt attachments isDraft to threadId",
            })
            .lean(),
        ZMailMailboxEntry.countDocuments(filter),
    ]);

    // Filter out entries where message was not found
    const valid = entries.filter(e => e.messageId);

    return {
        entries: valid.map(e => ({
            entryId: e._id,
            messageId: e.messageId._id,
            threadId: e.threadId,
            folder: e.folder,
            isRead: e.isRead,
            isStarred: e.isStarred,
            isImportant: e.isImportant,
            isTrashed: e.isTrashed,
            isArchived: e.isArchived,
            senderName: e.messageId.senderName,
            senderAddress: e.messageId.senderAddress,
            to: e.messageId.to,
            subject: e.messageId.subject,
            snippet: makeSnippet(e.messageId.body, 120),
            sentAt: e.messageId.sentAt,
            hasAttachment: (e.messageId.attachments || []).length > 0,
            attachmentCount: (e.messageId.attachments || []).length,
            isDraft: e.messageId.isDraft,
        })),
        pagination: {
            total,
            page: Math.max(1, page),
            limit: Math.min(100, limit),
            pages: Math.ceil(total / Math.min(100, limit)),
        },
    };
}

/**
 * Get a single message by ID.
 * Performs authorization: user must have a mailbox entry for this message.
 */
export async function getMessage({ userId, messageId }) {
    if (!isValidObjectId(messageId)) throw new Error("Invalid message ID");

    const entry = await ZMailMailboxEntry.findOne({ userId, messageId, isDeleted: false }).lean();
    if (!entry) throw new Error("Message not found or access denied");

    const message = await ZMailMessage.findById(messageId).lean();
    if (!message) throw new Error("Message not found");

    // Strip BCC from the message if the viewer is not the original sender
    const viewerIsSender = message.senderUserId.toString() === userId.toString();
    const sanitizedBcc = viewerIsSender ? message.bcc : [];

    return {
        ...message,
        bcc: sanitizedBcc,
        entry: {
            isRead: entry.isRead,
            isStarred: entry.isStarred,
            isImportant: entry.isImportant,
            isTrashed: entry.isTrashed,
            isArchived: entry.isArchived,
            folder: entry.folder,
        },
    };
}

/**
 * Get all messages in a thread for a user.
 * Authorization: user must have at least one mailbox entry in this thread.
 */
export async function getThread({ userId, threadId }) {
    if (!isValidObjectId(threadId)) throw new Error("Invalid thread ID");

    const thread = await ZMailThread.findById(threadId).lean();
    if (!thread) throw new Error("Thread not found");

    // Auth: user must be a participant
    const isParticipant = thread.participantIds.some(id => id.toString() === userId.toString());
    if (!isParticipant) throw new Error("Access denied");

    const entries = await ZMailMailboxEntry.find({ userId, threadId, isDeleted: false })
        .select("messageId isRead isStarred isImportant folder")
        .lean();

    if (entries.length === 0) throw new Error("No access to this thread");

    const messageIds = entries.map(e => e.messageId);
    const messages = await ZMailMessage.find({ _id: { $in: messageIds } })
        .sort({ sentAt: 1 })
        .lean();

    // Merge entry state into each message
    const entryMap = {};
    for (const e of entries) {
        entryMap[e.messageId.toString()] = e;
    }

    return {
        thread,
        messages: messages.map(m => {
            const e = entryMap[m._id.toString()] || {};
            const viewerIsSender = m.senderUserId.toString() === userId.toString();
            return {
                ...m,
                bcc: viewerIsSender ? m.bcc : [],
                entryState: {
                    isRead: e.isRead || false,
                    isStarred: e.isStarred || false,
                    isImportant: e.isImportant || false,
                    folder: e.folder,
                },
            };
        }),
    };
}

// ─── Message State Mutations ──────────────────────────────────────────────────

async function getOwnEntry(userId, messageId) {
    if (!isValidObjectId(messageId)) throw new Error("Invalid message ID");
    const entry = await ZMailMailboxEntry.findOne({ userId, messageId, isDeleted: false });
    if (!entry) throw new Error("Message not found or access denied");
    return entry;
}

export async function markRead({ userId, messageId }) {
    const entry = await getOwnEntry(userId, messageId);
    if (!entry.isRead) {
        entry.isRead = true;
        entry.lastSeenAt = new Date();
        await entry.save();
        await invalidateCachedUnread(userId);
    }
    return entry;
}

export async function markUnread({ userId, messageId }) {
    const entry = await getOwnEntry(userId, messageId);
    if (entry.isRead) {
        entry.isRead = false;
        await entry.save();
        await invalidateCachedUnread(userId);
    }
    return entry;
}

export async function starMessage({ userId, messageId, starred }) {
    const entry = await getOwnEntry(userId, messageId);
    entry.isStarred = starred;
    await entry.save();
    return entry;
}

export async function markImportant({ userId, messageId, important }) {
    const entry = await getOwnEntry(userId, messageId);
    entry.isImportant = important;
    await entry.save();
    return entry;
}

/**
 * Move message to trash (soft delete).
 */
export async function trashMessage({ userId, messageId }) {
    const entry = await getOwnEntry(userId, messageId);
    entry.isTrashed = true;
    entry.trashedAt = new Date();
    await entry.save();
    if (!entry.isRead) {
        entry.isRead = true;
        await invalidateCachedUnread(userId);
    }
    return entry;
}

/**
 * Restore message from trash back to original folder.
 */
export async function restoreMessage({ userId, messageId }) {
    const entry = await ZMailMailboxEntry.findOne({ userId, messageId, isTrashed: true });
    if (!entry) throw new Error("Message not found in trash or access denied");
    entry.isTrashed = false;
    entry.trashedAt = null;
    await entry.save();
    return entry;
}

/**
 * Permanently delete a mailbox entry (user's view only — does not destroy the message).
 * Other participants' entries are unaffected.
 */
export async function permanentlyDeleteEntry({ userId, messageId }) {
    const entry = await ZMailMailboxEntry.findOne({ userId, messageId });
    if (!entry) throw new Error("Message not found or access denied");
    entry.isDeleted = true;
    entry.deletedAt = new Date();
    await entry.save();
    return { deleted: true };
}

/**
 * Archive a message.
 */
export async function archiveMessage({ userId, messageId }) {
    const entry = await getOwnEntry(userId, messageId);
    entry.isArchived = true;
    entry.archivedAt = new Date();
    await entry.save();
    return entry;
}

/**
 * Empty trash: permanently delete all trashed entries for a user.
 */
export async function emptyTrash({ userId }) {
    const result = await ZMailMailboxEntry.updateMany(
        { userId, isTrashed: true, isDeleted: false },
        { isDeleted: true, deletedAt: new Date() }
    );
    return { deletedCount: result.modifiedCount };
}

/**
 * Mark all messages in a thread as read for a user.
 */
export async function markThreadRead({ userId, threadId }) {
    if (!isValidObjectId(threadId)) throw new Error("Invalid thread ID");
    await ZMailMailboxEntry.updateMany(
        { userId, threadId, isRead: false, isDeleted: false },
        { isRead: true, lastSeenAt: new Date() }
    );
    await invalidateCachedUnread(userId);
    return { updated: true };
}

/**
 * Perform a bulk action on multiple messages.
 */
export async function bulkAction({ userId, messageIds, action }) {
    if (!Array.isArray(messageIds) || messageIds.length === 0) return { updated: 0 };
    
    // Validate ObjectIds
    const validIds = messageIds.filter(isValidObjectId);
    if (validIds.length === 0) return { updated: 0 };

    const filter = { userId, messageId: { $in: validIds }, isDeleted: false };
    let update = {};
    let invalidateUnread = false;

    switch (action) {
        case "markRead":
            update = { isRead: true, lastSeenAt: new Date() };
            invalidateUnread = true;
            break;
        case "markUnread":
            update = { isRead: false };
            invalidateUnread = true;
            break;
        case "star":
            update = { isStarred: true };
            break;
        case "unstar":
            update = { isStarred: false };
            break;
        case "archive":
            update = { isArchived: true, archivedAt: new Date() };
            break;
        case "trash":
            update = { isTrashed: true, trashedAt: new Date(), isRead: true }; // Trashing also marks as read usually
            invalidateUnread = true;
            break;
        case "restore":
            // Special filter for restore
            const restoreFilter = { userId, messageId: { $in: validIds }, isTrashed: true };
            const rResult = await ZMailMailboxEntry.updateMany(restoreFilter, { isTrashed: false, trashedAt: null });
            return { updated: rResult.modifiedCount };
        case "delete":
            const dResult = await ZMailMailboxEntry.updateMany(filter, { isDeleted: true, deletedAt: new Date() });
            await invalidateCachedUnread(userId);
            return { updated: dResult.modifiedCount };
        default:
            throw new Error("Invalid bulk action");
    }

    const result = await ZMailMailboxEntry.updateMany(filter, update);
    if (invalidateUnread) await invalidateCachedUnread(userId);
    return { updated: result.modifiedCount };
}

// ─── Unread Count ─────────────────────────────────────────────────────────────

export async function getUnreadCount(userId) {
    const cached = await getCachedUnread(userId);
    if (cached !== null) return cached;

    const count = await ZMailMailboxEntry.countDocuments({
        userId,
        folder: "inbox",
        isRead: false,
        isTrashed: false,
        isDeleted: false,
        isArchived: false,
    });
    await setCachedUnread(userId, count);
    return count;
}

export async function getDraftCount(userId) {
    return ZMailMailboxEntry.countDocuments({
        userId,
        folder: "drafts",
        isTrashed: false,
        isDeleted: false,
    });
}

// ─── Drafts ───────────────────────────────────────────────────────────────────

/**
 * Create a new draft.
 */
export async function createDraft({ senderUserId, to = [], cc = [], bcc = [], subject = "", body = "", attachments = [] }) {
    const senderAccount = await ZMailAccount.findOne({ userId: senderUserId }).lean();
    if (!senderAccount) throw new Error("ZeroleakMail account not provisioned");

    // Create a new thread for the draft
    const thread = await ZMailThread.create({
        subject: (subject || "(no subject)").trim().slice(0, MAX_SUBJECT_LENGTH),
        participantIds: [senderAccount.userId],
        participantAddresses: [senderAccount.zmailAddress],
    });

    const message = await ZMailMessage.create({
        threadId: thread._id,
        senderUserId: senderAccount.userId,
        senderAddress: senderAccount.zmailAddress,
        senderName: senderAccount.displayName,
        to,
        cc,
        bcc,
        subject: (subject || "(no subject)").trim().slice(0, MAX_SUBJECT_LENGTH),
        body: body || "",
        attachments,
        isDraft: true,
        draftOwnerId: senderAccount.userId,
        draftVersion: 1,
    });

    await ZMailMailboxEntry.create({
        userId: senderAccount.userId,
        messageId: message._id,
        threadId: thread._id,
        folder: "drafts",
        isRead: true,
    });

    return { message, thread };
}

/**
 * Update a draft.
 * Uses optimistic version check to prevent race conditions between multiple tabs.
 */
export async function updateDraft({ userId, draftId, updates, clientVersion }) {
    if (!isValidObjectId(draftId)) throw new Error("Invalid draft ID");

    const message = await ZMailMessage.findOne({
        _id: draftId,
        isDraft: true,
        draftOwnerId: userId,
    });

    if (!message) throw new Error("Draft not found or access denied");

    // Optimistic locking: reject stale writes
    if (clientVersion !== undefined && message.draftVersion !== clientVersion) {
        throw new Error("Draft conflict: another session has modified this draft. Please reload.");
    }

    const allowed = ["to", "cc", "bcc", "subject", "body", "attachments"];
    for (const key of allowed) {
        if (updates[key] !== undefined) {
            message[key] = updates[key];
        }
    }
    message.draftVersion += 1;

    // Update thread subject if subject changed
    if (updates.subject) {
        await ZMailThread.updateOne(
            { _id: message.threadId },
            { subject: (updates.subject || "").trim().slice(0, MAX_SUBJECT_LENGTH) }
        );
    }

    await message.save();
    return message;
}

/**
 * Send a saved draft.
 * Converts the draft to a sent message and creates mailbox entries for recipients.
 */
export async function sendDraft({ userId, draftId, io = null }) {
    if (!isValidObjectId(draftId)) throw new Error("Invalid draft ID");

    const draft = await ZMailMessage.findOne({
        _id: draftId,
        isDraft: true,
        draftOwnerId: userId,
    });

    if (!draft) throw new Error("Draft not found or access denied");

    // Validate that there is at least one recipient
    if (!draft.to || draft.to.length === 0) {
        throw new Error("Draft has no recipients. Please add at least one recipient.");
    }

    // Validate body
    if (!draft.body || draft.body.trim().length === 0) {
        throw new Error("Draft body is empty");
    }

    // Re-validate all recipients to ensure they still exist
    const toAddresses = draft.to.map(r => r.address);
    const resolvedTo = await resolveAndValidateRecipients(toAddresses);
    const ccAddresses = (draft.cc || []).map(r => r.address);
    const resolvedCc = ccAddresses.length ? await resolveAndValidateRecipients(ccAddresses) : [];
    const bccAddresses = (draft.bcc || []).map(r => r.address);
    const resolvedBcc = bccAddresses.length ? await resolveAndValidateRecipients(bccAddresses) : [];

    // Convert draft to sent message
    draft.isDraft = false;
    draft.sentAt = new Date();
    draft.to = resolvedTo;
    draft.cc = resolvedCc;
    draft.bcc = resolvedBcc;
    draft.draftOwnerId = null;
    await draft.save();

    // Update thread
    const thread = await ZMailThread.findById(draft.threadId);
    if (thread) {
        const allRecipients = [...resolvedTo, ...resolvedCc, ...resolvedBcc];
        const senderAccount = await ZMailAccount.findOne({ userId }).lean();
        const participantIds = [...new Set([
            userId.toString(),
            ...allRecipients.map(r => r.userId.toString()),
        ])].map(id => new mongoose.Types.ObjectId(id));
        const participantAddresses = [...new Set([
            senderAccount?.zmailAddress || "",
            ...allRecipients.map(r => r.address),
        ])];
        thread.participantIds = participantIds;
        thread.participantAddresses = participantAddresses;
        thread.latestMessageId = draft._id;
        thread.latestMessageAt = draft.sentAt;
        thread.messageCount = (thread.messageCount || 0) + 1;
        thread.snippet = makeSnippet(draft.body);
        thread.hasAttachment = (draft.attachments || []).length > 0 || thread.hasAttachment;
        await thread.save();
    }

    // Update sender's mailbox entry from drafts -> sent
    await ZMailMailboxEntry.updateOne(
        { userId, messageId: draft._id },
        { folder: "sent" }
    );

    // Create inbox entries for recipients
    const inboxRecipients = [...new Set([
        ...resolvedTo.map(r => r.userId.toString()),
        ...resolvedCc.map(r => r.userId.toString()),
        ...resolvedBcc.map(r => r.userId.toString()),
    ])].filter(id => id !== userId.toString());

    const inboxEntries = inboxRecipients.map(recipientId => ({
        userId: new mongoose.Types.ObjectId(recipientId),
        messageId: draft._id,
        threadId: draft.threadId,
        folder: "inbox",
        isRead: false,
    }));
    if (inboxEntries.length > 0) {
        await ZMailMailboxEntry.insertMany(inboxEntries);
    }

    // Invalidate unread caches
    for (const recipientId of inboxRecipients) {
        await invalidateCachedUnread(recipientId);
    }

    // Real-time notifications
    if (io) {
        const senderAccount = await ZMailAccount.findOne({ userId }).lean();
        const notification = {
            messageId: draft._id,
            threadId: draft.threadId,
            senderName: draft.senderName,
            senderAddress: draft.senderAddress,
            subject: draft.subject,
            snippet: makeSnippet(draft.body, 120),
            sentAt: draft.sentAt,
            hasAttachment: (draft.attachments || []).length > 0,
        };
        for (const recipientId of inboxRecipients) {
            io.to(`zmail:user:${recipientId}`).emit("zmail:new-message", notification);
        }
    }

    return draft;
}

/**
 * Delete a draft permanently.
 */
export async function deleteDraft({ userId, draftId }) {
    if (!isValidObjectId(draftId)) throw new Error("Invalid draft ID");

    const message = await ZMailMessage.findOne({
        _id: draftId,
        isDraft: true,
        draftOwnerId: userId,
    });
    if (!message) throw new Error("Draft not found or access denied");

    // Remove mailbox entry and the message itself
    await ZMailMailboxEntry.deleteOne({ userId, messageId: draftId });
    await ZMailMessage.deleteOne({ _id: draftId });
    await ZMailThread.deleteOne({ _id: message.threadId });

    return { deleted: true };
}

// ─── Reply / Forward ──────────────────────────────────────────────────────────

/**
 * Reply to a message.
 */
export async function replyToMessage({ senderUserId, messageId, body, attachments = [], replyAll = false, io = null }) {
    if (!isValidObjectId(messageId)) throw new Error("Invalid message ID");

    const original = await ZMailMessage.findById(messageId).lean();
    if (!original) throw new Error("Original message not found");

    // Auth: sender must have access to the original message
    const entry = await ZMailMailboxEntry.findOne({ userId: senderUserId, messageId, isDeleted: false }).lean();
    if (!entry) throw new Error("Message not found or access denied");

    // Build reply recipients
    const to = [original.senderAddress];
    let cc = [];
    if (replyAll) {
        // Add all original To recipients (except the current sender)
        const senderAccount = await ZMailAccount.findOne({ userId: senderUserId }).lean();
        const senderAddr = senderAccount?.zmailAddress;
        const otherTo = original.to.map(r => r.address).filter(a => a !== senderAddr);
        const otherCc = original.cc.map(r => r.address).filter(a => a !== senderAddr);
        cc = [...new Set([...otherTo, ...otherCc])];
    }

    const replySubject = original.subject.startsWith("Re: ") ? original.subject : `Re: ${original.subject}`;

    return sendMail({
        senderUserId,
        to,
        cc,
        bcc: [],
        subject: replySubject,
        body,
        attachments,
        replyToMessageId: messageId,
        existingThreadId: original.threadId.toString(),
        io,
    });
}

/**
 * Forward a message.
 */
export async function forwardMessage({ senderUserId, messageId, to, body = "", attachments = [], io = null }) {
    if (!isValidObjectId(messageId)) throw new Error("Invalid message ID");

    const original = await ZMailMessage.findById(messageId).lean();
    if (!original) throw new Error("Original message not found");

    // Auth: sender must have access to the original message
    const entry = await ZMailMailboxEntry.findOne({ userId: senderUserId, messageId, isDeleted: false }).lean();
    if (!entry) throw new Error("Message not found or access denied");

    const fwdSubject = original.subject.startsWith("Fwd: ") ? original.subject : `Fwd: ${original.subject}`;
    const fwdBody = `${body}\n\n---------- Forwarded message ----------\nFrom: ${original.senderName} <${original.senderAddress}>\nDate: ${original.sentAt?.toISOString()}\nSubject: ${original.subject}\n\n${original.body}`;

    return sendMail({
        senderUserId,
        to,
        cc: [],
        bcc: [],
        subject: fwdSubject,
        body: fwdBody.slice(0, MAX_BODY_LENGTH),
        attachments,
        forwardedFromMessageId: messageId,
        io,
    });
}

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Server-side search.
 * Supports: from:, to:, subject:, is:unread, is:starred, has:attachment, free text
 */
export async function searchMail({ userId, query, page = 1, limit = 25 }) {
    const skip = (Math.max(1, page) - 1) * Math.min(50, limit);

    // Parse query tokens
    const fromMatch    = query.match(/from:(\S+)/);
    const toMatch      = query.match(/to:(\S+)/);
    const subjectMatch = query.match(/subject:([^\s]+(?:\s+[^\s:]+)*)/);
    const isUnread     = /is:unread/i.test(query);
    const isStarred    = /is:starred/i.test(query);
    const hasAtt       = /has:attachment/i.test(query);

    // Strip tokens from query to get free-text portion
    const freeText = query
        .replace(/from:\S+/gi, "")
        .replace(/to:\S+/gi, "")
        .replace(/subject:\S+/gi, "")
        .replace(/is:\S+/gi, "")
        .replace(/has:\S+/gi, "")
        .trim();

    // Build entry filter
    const entryFilter = { userId, isDeleted: false, isTrashed: false };
    if (isUnread) entryFilter.isRead = false;
    if (isStarred) entryFilter.isStarred = true;

    const entries = await ZMailMailboxEntry.find(entryFilter)
        .select("messageId isRead isStarred isImportant folder")
        .lean();

    if (entries.length === 0) {
        return { results: [], pagination: { total: 0, page, limit, pages: 0 } };
    }

    const messageIds = entries.map(e => e.messageId);

    // Build message filter
    const msgFilter = { _id: { $in: messageIds }, isDraft: false };
    if (fromMatch) msgFilter.senderAddress = { $regex: fromMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    if (toMatch) msgFilter["to.address"] = { $regex: toMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    if (subjectMatch) msgFilter.subject = { $regex: subjectMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    if (hasAtt) msgFilter["attachments.0"] = { $exists: true };
    if (freeText) {
        msgFilter.$or = [
            { subject: { $regex: freeText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
            { body: { $regex: freeText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
            { senderName: { $regex: freeText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
        ];
    }

    const [messages, total] = await Promise.all([
        ZMailMessage.find(msgFilter)
            .sort({ sentAt: -1 })
            .skip(skip)
            .limit(Math.min(50, limit))
            .lean(),
        ZMailMessage.countDocuments(msgFilter),
    ]);

    // Merge entry states
    const entryMap = {};
    for (const e of entries) entryMap[e.messageId.toString()] = e;

    return {
        results: messages.map(m => {
            const e = entryMap[m._id.toString()] || {};
            return {
                messageId: m._id,
                threadId: m.threadId,
                senderName: m.senderName,
                senderAddress: m.senderAddress,
                subject: m.subject,
                snippet: makeSnippet(m.body, 120),
                sentAt: m.sentAt,
                hasAttachment: (m.attachments || []).length > 0,
                isRead: e.isRead || false,
                isStarred: e.isStarred || false,
                isImportant: e.isImportant || false,
                folder: e.folder,
            };
        }),
        pagination: {
            total,
            page: Math.max(1, page),
            limit: Math.min(50, limit),
            pages: Math.ceil(total / Math.min(50, limit)),
        },
    };
}

// ─── User search (autocomplete) ───────────────────────────────────────────────

/**
 * Search for ZeroLeak users by display name or ZMail address.
 * Returns minimal information only.
 */
export async function searchUsers({ query, limit = 10 }) {
    if (!query || query.trim().length < 1) return [];

    const safe = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const results = await ZMailAccount.find({
        mailboxStatus: "active",
        $or: [
            { displayName: { $regex: safe, $options: "i" } },
            { zmailAddress: { $regex: safe, $options: "i" } },
        ],
    })
        .select("zmailAddress displayName userType")
        .limit(Math.min(20, limit))
        .lean();

    return results.map(r => ({
        address: r.zmailAddress,
        name: r.displayName,
        role: r.userType,
    }));
}
