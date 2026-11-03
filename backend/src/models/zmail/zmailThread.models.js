import mongoose, { Schema } from "mongoose";


const zmailThreadSchema = new Schema(
    {
        subject: { type: String, required: true, trim: true, maxlength: 998, default: "(no subject)" },
        participantIds: [{ type: Schema.Types.ObjectId, ref: "ZMailAccount", index: true }],
        participantAddresses: [String],
        latestMessageId: { type: Schema.Types.ObjectId, ref: "ZMailMessage", default: null },
        latestMessageAt: { type: Date, default: null, index: true },
        messageCount: { type: Number, default: 0, min: 0 },
        snippet: { type: String, default: "", maxlength: 300 },
        hasAttachment: { type: Boolean, default: false },
    }, { timestamps: true }
);

zmailThreadSchema.index({ participantIds: 1, latestMessageAt: -1 });
zmailThreadSchema.index({ latestMessageAt: -1 });

export const ZMailThread = mongoose.model("ZMailThread", zmailThreadSchema)