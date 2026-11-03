import mongoose, { Schema } from "mongoose";



const FOLDERS = ["inbox", "sent", "drafts", "trash", "archive", "all"];

const zmailMailboxEntrySchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, required: true, index: true },
        messageId: { type: Schema.Types.ObjectId, ref: "ZMailMessage", required: true, index: true },
        threadId: { type: Schema.Types.ObjectId, ref: "ZMailThread", required: true, index: true },
        folder: { type: String, enum: FOLDERS, required: true, index: true },
        isRead: { type: Boolean, default: false, index: true },
        isStarred: { type: Boolean, default: false },
        isImportant: { type: Boolean, default: false },
        isTrashed: { type: Boolean, default: false, index: true },
        trashedAt: { type: Date, default: null },
        isArchived: { type: Boolean, default: false },
        archivedAt: { type: Date, default: null },
        isDeleted: { type: Boolean, default: false, index: true },
        deletedAt: { type: Date, default: null },
        lastSeenAt: { type: Date, default: null },
        labels: { type: [String], default: [] },
    }, { timestamps: true }
)

zmailMailboxEntrySchema.index({ userId: 1, messageId: 1 }, { unique: true });
zmailMailboxEntrySchema.index({ userId: 1, folder: 1, isTrashed: 1, isDeleted: 1, isArchived: 1, createdAt: -1 });
zmailMailboxEntrySchema.index({ userId: 1, isRead: 1, isTrashed: 1, isDeleted: 1 });
zmailMailboxEntrySchema.index({ userId: 1, isStarred: 1, isTrashed: 1, isDeleted: 1 });
zmailMailboxEntrySchema.index({ userId: 1, threadId: 1, isDeleted: 1 });
zmailMailboxEntrySchema.index({ isTrashed: 1, trashedAt: 1 });

export const ZMailMailboxEntry = mongoose.model("ZMailMailboxEntry", zmailMailboxEntrySchema);