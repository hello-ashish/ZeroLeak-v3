import mongoose from "mongoose";

const examSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    durationMinutes: { type: Number, required: true, default: 60 },
    passingPercentage: { type: Number, default: 50 },
    totalMarks: { type: Number, default: 0 },
    status: { type: String, enum: ["Draft", "Scheduled", "Live", "GracePeriod", "Completed", "Archived"], default: "Draft" },
    scheduledAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    examinationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Examination', required: true },
    subject: { type: String, required: true },
    mode: { type: String, enum: ["Normal", "Zeroleak"], default: "Normal" },
    zeroleakConfig: {
        numQuestions: { type: Number, default: 0 }
    },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    questionMerkleRoot: { type: String, default: null },

    isResultReleased: { type: Boolean, default: false },
}, { timestamps: true })


examSchema.index({ title: 'text', subject: 'text' });
examSchema.index({ status: 1 });
examSchema.index({ examinationId: 1 });
examSchema.index({ createdAt: -1 });
examSchema.index({ subject: 1 });

export const Exam = mongoose.model('Exam', examSchema)