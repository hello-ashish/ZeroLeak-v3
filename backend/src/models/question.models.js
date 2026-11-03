import mongoose from "mongoose";

const encryptedContentSchema = new mongoose.Schema(
    {
        ciphertext: { type: String, required: true },
        iv: { type: String, required: true },
        authTag: { type: String, required: true },
    },
    { _id: false }
);

const questionSchema = new mongoose.Schema(
    {
        encryptedContent: { type: encryptedContentSchema, required: true },
        contentHash: { type: String, required: true, index: true },
        difficultyLevel: { type: String, enum: ["easy", "medium", "hard"], required: true },
        subject: { type: String, required: true },
        topic: { type: String, required: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Professor", required: true },
    }, { timestamps: true }
);

questionSchema.index({ subject: 1 });
questionSchema.index({ createdBy: 1 });
questionSchema.index({ subject: 1, difficultyLevel: 1 });
questionSchema.index({ createdAt: -1 });
questionSchema.index({ subject: 1, createdAt: -1 });

export const Question = mongoose.model("Question", questionSchema)