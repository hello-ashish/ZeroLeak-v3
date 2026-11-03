import mongoose from "mongoose"

const auditLogSchema = new mongoose.Schema({
    actor: { type: String, required: true },
    actorRole: { type: String, enum: ["Admin", "Professor", "System", "Student", "Auditor", "Support"], default: "Admin" },
    action: { type: String, required: true },
    targetType: { type: String },
    targetId: { type: String },
    targetLabel: { type: String },
    details: { type: String },
    status: { type: String, enum: ["success", "failure"], default: "success" },
    isCommitted: { type: Boolean, default: false }
}, { timestamps: true })


auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ actorRole: 1, action: 1, createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema)