import mongoose from "mongoose"

const resultSchema = new mongoose.Schema({

    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    status: { type: String, enum: ["InProgress", "Completed", "Terminated"], default: "Completed" },
    assignedQuestions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
    latestAnswers: { type: Array, default: [] },
    isTerminated: { type: Boolean, default: false },
    terminationReason: { type: String, default: null },
    resetByAdmin: { type: Boolean, default: false },
    resetByAdminAt: { type: Date, default: null },

}, { timestamps: true })


resultSchema.index(
    { student: 1, exam: 1 },
    { unique: true, partialFilterExpression: { resetByAdmin: false } }
);
resultSchema.index({ student: 1, exam: 1, resetByAdmin: 1 });
resultSchema.index({ exam: 1 });
resultSchema.index({ student: 1, isTerminated: 1, resetByAdmin: 1 });

export const Result = mongoose.model("Result", resultSchema)