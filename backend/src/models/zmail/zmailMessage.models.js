import mongoose, { Schema } from "mongoose";



const attachmentSchema = new Schema(
    {
        originalName: { type: String, required: true, trim: true, maxlength: 255 },
        storageName: { type: String, required: true },
        storageKey: { type: String, required: true },
        mimeType: { type: String, required: true, maxlength: 127 },
        sizeBytes: { type: Number, required: true, min: 0 },
        uploadedAt: { type: Date, default: Date.now },
    }, { _id: true }
);

const recipientSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, required: true },
        address: { type: String, required: true, lowercase: true },
        name: { type: String, default: "" },
    }, { _id: false }
);

const zmailMessageSchema = new Schema(
    {
        threadId: { type: Schema.Types.ObjectId, ref: "ZMailThread", required: true, index: true },
        senderUserId: { type: Schema.Types.ObjectId, required: true, index: true },
        senderAddress: { type: String, required: true, lowercase: true },
        senderName: { type: String, required: true, trim: true },
        to: [recipientSchema],
        cc: { type: [recipientSchema], default: [] },
        bcc: { type: [recipientSchema], default: [] },
        subject: { type: String, required: true, trim: true, maxlength: 998, default: "(no subject)" },
        body: { type: String, required: true, maxlength: 204800 },
        attachments: { type: [attachmentSchema], default: [] },
        replyToMessageId: { type: Schema.Types.ObjectId, ref: "ZMailMessage", default: null },
        forwardedFromMessageId: { type: Schema.Types.ObjectId, ref: "ZMailMessage", default: null },
        isDraft: { type: Boolean, default: false, index: true },
        draftVersion: { type: Number, default: 0 },
        draftOwnerId: { type: Schema.Types.ObjectId, default: null },
        sentAt: { type: Date, default: null, index: true },
    },
    { timestamps: true }
);

zmailMessageSchema.index({ threadId: 1, sentAt: 1 });
zmailMessageSchema.index({ senderUserId: 1, sentAt: -1 });
zmailMessageSchema.index({ isDraft: 1, draftOwnerId: 1, createdAt: -1 });

export const ZMailMessage = mongoose.model("ZMailMessage", zmailMessageSchema);