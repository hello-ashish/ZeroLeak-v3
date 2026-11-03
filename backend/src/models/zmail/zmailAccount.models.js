import mongoose, { Schema } from "mongoose";


const zmailAccountSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, required: true, unique: true },
        userType: { type: String, enum: ["Student", "Professor", "Admin", "Auditor", "SYSTEM", "Support"], required: true },
        isSupportMailbox: { type: Boolean, default: false, index: true },
        zmailAddress: { type: String, required: true, unique: true, lowercase: true, trim: true, match: [/^[a-z0-9._+-]+@zeroleak\.com$/, "Invalid ZMail address format"] },
        normalizedAddress: { type: String, required: true, unique: true, lowercase: true, trim: true },
        displayName: { type: String, required: true, trim: true },
        mailboxStatus: { type: String, enum: ["active", "suspended", "deleted"], default: "active" },
        storageUsedBytes: { type: Number, default: 0, min: 0 },
        cachedUnreadCount: { type: Number, default: 0, min: 0 },
    }, { timestamps: true }
);

zmailAccountSchema.index({ userId: 1, userType: 1 });

export const ZMailAccount = mongoose.model("ZMailAccount", zmailAccountSchema);