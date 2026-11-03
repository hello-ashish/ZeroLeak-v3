import mongoose, { Schema } from "mongoose"


const draftQuestionSchema = new Schema({
    title: { type: String, required: true },
    options: { type: [String], default: [] },
    correctAnswer: { type: String },
    difficultyLevel: { type: String, enum: ["easy", "medium", "hard"], required: true },
    subject: { type: String, required: true },
    topic: { type: String, required: true },
    correctAnswerIndex: { type: Number },
    contentHash: { type: String },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question" }
}, { timestamps: true})

const batchSchema = new Schema({
    title: { type: String, required: true },
    description: {
        type: String
    },
    subject: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref:"Professor", required: true },
    questions: [draftQuestionSchema],
    status: { type: String, enum: ["Draft", "Submitted", "Accepted", "Rejected", "MarkForReview"], default: "Draft" },
    adminMessage: { type: String, default: "" },
    openedByAdmin: { type: Boolean, default: false },
    isDeletedByAdmin: { type: Boolean, default: false },
    isDeletedByProfessor: { type: Boolean, default: false },
    merkleRoot: { type: String, default: null },

}, { timestamps: true})


batchSchema.index({ title: 'text', subject: 'text' });
batchSchema.index({ createdBy: 1, status: 1 });
batchSchema.index({ status: 1, isDeletedByAdmin: 1 });
batchSchema.index({ createdAt: -1 });

export const Batch = mongoose.model("Batch", batchSchema)