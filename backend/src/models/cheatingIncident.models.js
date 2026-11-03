import mongoose, { Schema } from "mongoose";

const cheatingIncidentSchema = new Schema(
    {
        studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
        examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
        attemptId: { type: Schema.Types.ObjectId, ref: "Result", default: null },
        violationType: { type: String, required: true, trim: true },
        severity: { type: String, enum: ["Low", "Medium", "High", "Critical"], default: "Medium" },
        description: { type: String, required: true, trim: true },
        detectedAt: { type: Date, default: Date.now },
        actionTaken: { type: String, enum: ["WARNING", "AUTO_SUBMIT", "EXAM_TERMINATED", "STUDENT_BLOCKED", "NONE"], default: "NONE" },
        reviewStatus: { type: String, enum: ["Pending", "Under Review", "Confirmed", "Dismissed"], default: "Pending" },
        evidenceData: {
            type: Schema.Types.Mixed,
            default: {},
        },
        reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
        reviewedAt: { type: Date, default: null },

    },
    { timestamps: true }
);


cheatingIncidentSchema.index({ studentId: 1, examId: 1 });
cheatingIncidentSchema.index({ reviewStatus: 1 });
cheatingIncidentSchema.index({ detectedAt: -1 });
cheatingIncidentSchema.index({ violationType: 1 });

export const CheatingIncident = mongoose.model("CheatingIncident", cheatingIncidentSchema);
