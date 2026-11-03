import mongoose from "mongoose";

const examinationSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    status: { type: String, enum: ["Draft", "Ongoing", "Completed", "Archived"], default: "Draft" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    isResultReleased: { type: Boolean, default: false },
}, { timestamps: true })

export const Examination = mongoose.model('Examination', examinationSchema)