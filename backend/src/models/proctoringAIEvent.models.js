import mongoose, { Schema } from "mongoose";


const proctoringAIEventSchema = new Schema(
    {
        sessionId: { type: Schema.Types.ObjectId, ref: "ProctoringSession", required: true, index: true },
        examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
        studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },

        type: {
            type: String,
            required: true,
            enum: [
                "FACE_MISSING",
                "MULTIPLE_FACES",
                "UNUSUAL_FACE_POSITION",
                "PHONE_LIKE_OBJECT",
                "SCREEN_ANOMALY",
                "UNEXPECTED_CONTENT",
                "UNUSUAL_AUDIO",
                "MULTIPLE_VOICES",
                "TAB_SWITCH",
                "WINDOW_BLUR",
                "FULLSCREEN_EXIT",
                "SCREEN_SHARE_STOPPED",
                "RAPID_ANSWER_CHANGE",
                "COPY_PASTE_DETECTED"
            ]
        },
        confidence: { type: Number, required: true, min: 0, max: 1 },
        scoreContribution: { type: Number, required: true, min: 0, max: 100 },
        modelVersion: { type: String, default: "mock-v0" },
        metadata: { type: Schema.Types.Mixed, default: {} },
        reviewStatus: { type: String, enum: ["PENDING", "REVIEWED", "DISMISSED"], default: "PENDING", index: true },
        reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
        reviewedAt: { type: Date, default: null }
    }, { timestamps: true }
);

proctoringAIEventSchema.index({ sessionId: 1, createdAt: -1 });
proctoringAIEventSchema.index({ examId: 1, createdAt: -1 });
proctoringAIEventSchema.index({ studentId: 1, createdAt: -1 });
proctoringAIEventSchema.index({ reviewStatus: 1, createdAt: -1 });
proctoringAIEventSchema.index({ type: 1, createdAt: -1 });

export const ProctoringAIEvent = mongoose.model("ProctoringAIEvent", proctoringAIEventSchema);