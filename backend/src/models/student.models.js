import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const studentSchema = new Schema(
    {
        studentId: { type: String, required: true, unique: true },
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true },
        department: { type: String, trim: true },
        batch: { type: String, trim: true },
        contact: { type: String, trim: true },
        dateOfBirth: { type: Date },
        address: { type: String, trim: true },
        gender: { type: String, enum: ['Male', 'Female', 'Other'] },
        program: { type: String, trim: true },
        isBlocked: { type: Boolean, default: false },
        blockedAt: { type: Date, default: null },
        blockedReason: { type: String, default: null },
        unblockedAt: { type: Date, default: null },
        lastActiveAt: { type: Date, default: null },
        isLoggedIn: { type: Boolean, default: false },
        currentExamId: { type: Schema.Types.ObjectId, ref: 'Exam', default: null },
        sessionVersion: { type: Number, default: 0 }
    },
    { timestamps: true }
);


studentSchema.index({ name: 'text', email: 'text', studentId: 'text' });
studentSchema.index({ isBlocked: 1 });
studentSchema.index({ lastActiveAt: 1, currentExamId: 1 });
studentSchema.index({ isBlocked: 1, unblockedAt: -1 });
studentSchema.index({ createdAt: -1 });


studentSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 10);
});


studentSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
};


studentSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            id: this._id,
            email: this.email,
            studentId: this.studentId,
            role: "Student",
            sessionVersion: this.sessionVersion
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1d" }
    );
};

export const Student = mongoose.model("Student", studentSchema);