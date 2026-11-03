import mongoose, { Schema } from "mongoose";

const proctoringIncidentSchema = new Schema(
    {
        examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
        studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
        proctoringSessionId: { type: Schema.Types.ObjectId, ref: "ProctoringSession", required: true },
        type: {
            type: String,
            required: true,
            enum: [
                "CAMERA_PERMISSION_DENIED",
                "CAMERA_DISCONNECTED",
                "CAMERA_RECONNECTED",
                "MICROPHONE_PERMISSION_DENIED",
                "MICROPHONE_DISCONNECTED",
                "MICROPHONE_RECONNECTED",
                "TAB_SWITCH",
                "WINDOW_BLUR",
                "WINDOW_FOCUS",
                "FULLSCREEN_EXIT",
                "FULLSCREEN_ENTER",
                "NETWORK_DISCONNECTED",
                "NETWORK_RECONNECTED",
                "PROCTORING_SOCKET_DISCONNECTED",
                "PROCTORING_SOCKET_RECONNECTED",
                "EXAM_STARTED",
                "EXAM_ENDED",
                "STREAM_STARTED",
                "STREAM_ENDED",
                "SCREEN_SHARE_STOPPED",
            ],
            trim: true,
        },
        timestamp: { type: Date, default: Date.now },
        severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM" },
        metadata: { type: Schema.Types.Mixed, default: {} },
        reviewed: { type: Boolean, default: false },
        reviewStatus: { type: String, enum: ["PENDING_REVIEW", "REVIEWED", "DISMISSED", "ACTION_TAKEN"], default: "PENDING_REVIEW" },
        reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
        reviewedAt: { type: Date, default: null },
        action: { type: String, default: null },
        notes: { type: String, default: null },
    }, { timestamps: true }
);

proctoringIncidentSchema.index({ examId: 1, studentId: 1 });
proctoringIncidentSchema.index({ examId: 1, reviewStatus: 1 });
proctoringIncidentSchema.index({ proctoringSessionId: 1 });
proctoringIncidentSchema.index({ type: 1 });
proctoringIncidentSchema.index({ severity: 1 });
proctoringIncidentSchema.index({ reviewStatus: 1 });
proctoringIncidentSchema.index({ timestamp: -1 });

export const ProctoringIncident = mongoose.model("ProctoringIncident", proctoringIncidentSchema);