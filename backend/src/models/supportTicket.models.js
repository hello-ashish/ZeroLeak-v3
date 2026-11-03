import mongoose, { Schema } from "mongoose";

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_FOR_USER", "WAITING_FOR_SUPPORT", "RESOLVED", "CLOSED"];
export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"];
export const TICKET_CATEGORIES = [
    "technical_issue", "login_authentication", "exam_issue", "proctoring_issue",
    "question_content_issue", "submission_issue", "account_issue",
    "performance_issue", "bug_report", "security_concern", "other",
];

const supportTicketSchema = new Schema({
    ticketNumber: { type: String, required: true, unique: true },

    reporterUserId: { type: Schema.Types.ObjectId, required: true, index: true },
    reporterRole: { type: String, enum: ["Student", "Professor", "Admin", "Auditor", "Support"], required: true },
    reporterEmail: { type: String, required: true, lowercase: true, trim: true },
    reporterName: { type: String, required: true, trim: true },

    zmailThreadId: { type: Schema.Types.ObjectId, ref: "ZMailThread", default: null, index: true },
    initialMessageId: { type: Schema.Types.ObjectId, ref: "ZMailMessage", default: null },

    title: { type: String, required: true, trim: true, maxlength: 255 },
    description: { type: String, required: true, trim: true, maxlength: 20000 },
    category: { type: String, enum: TICKET_CATEGORIES, required: true, default: "other" },

    reportedPriority: { type: String, enum: TICKET_PRIORITIES, default: "normal" },
    supportPriority: { type: String, enum: TICKET_PRIORITIES, default: "normal" },

    status: { type: String, enum: TICKET_STATUSES, default: "OPEN", index: true },

    assignedTo: { type: Schema.Types.ObjectId, default: null, index: true },
    assignedAt: { type: Date, default: null },
    assignedBy: { type: Schema.Types.ObjectId, default: null },

    relatedExamId: { type: Schema.Types.ObjectId, ref: "Exam", default: null },
    relatedSessionId: { type: Schema.Types.ObjectId, default: null },
    sourceRoute: { type: String, trim: true, maxlength: 500, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },

    aiSuggestedReply: { type: String, default: null },
    aiConfidence: { type: Number, default: null },
    aiRouted: { type: Boolean, default: false },

    lastMessageAt: { type: Date, default: null, index: true },
    lastCustomerMessageAt: { type: Date, default: null },
    lastSupportMessageAt: { type: Date, default: null },
    hasUnreadUserMessage: { type: Boolean, default: false, index: true },
    lastSupportReadAt: { type: Date, default: null },

    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    tags: { type: [String], default: [] },
    idempotencyKey: { type: String, default: null, sparse: true, index: true },
}, { timestamps: true });

supportTicketSchema.index({ status: 1, lastMessageAt: -1 });
supportTicketSchema.index({ assignedTo: 1, status: 1, lastMessageAt: -1 });
supportTicketSchema.index({ supportPriority: 1, status: 1, lastMessageAt: -1 });
supportTicketSchema.index({ reporterUserId: 1, createdAt: -1 });
supportTicketSchema.index({ category: 1, status: 1 });
supportTicketSchema.index({ hasUnreadUserMessage: 1, status: 1 });


const ticketCounterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });
export const TicketCounter = mongoose.model("TicketCounter", ticketCounterSchema);

export async function generateTicketNumber() {
    const year = new Date().getFullYear();
    const counter = await TicketCounter.findOneAndUpdate(
        { _id: `support_tickets_${year}` },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: "after" }
    );
    return `ZSUP-${year}-${counter.seq.toString().padStart(6, "0")}`;
}

export const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);