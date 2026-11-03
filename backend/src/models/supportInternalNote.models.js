import mongoose, { Schema } from "mongoose";

const supportInternalNoteSchema = new Schema({
    ticketId: { type: Schema.Types.ObjectId, ref: "SupportTicket", required: true, index: true },
    ticketNumber: { type: String, required: true },
    authorId: { type: Schema.Types.ObjectId, required: true },
    authorName: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true, maxlength: 10000 },
}, { timestamps: true });

supportInternalNoteSchema.index({ ticketId: 1, createdAt: 1 });

export const SupportInternalNote = mongoose.model("SupportInternalNote", supportInternalNoteSchema);
