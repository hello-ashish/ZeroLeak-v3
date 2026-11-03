import mongoose, { Schema } from "mongoose"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

const auditorSchema = new Schema(
    {
        auditorId: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: [true, "Password is required"] },
        name: { type: String, required: true, default: "Platform Auditor" },
        lastActiveAt: { type: Date, default: null },
        isLoggedIn: { type: Boolean, default: false },
        sessionVersion: { type: Number, default: 0 },
        isBlocked: { type: Boolean, default: false }
    }, { timestamps: true }
)

auditorSchema.index({ createdAt: -1 });
auditorSchema.index({ isBlocked: 1 });

auditorSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 10)
})

auditorSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)
}

auditorSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            id: this._id,
            email: this.email,
            role: "Auditor",
            sessionVersion: this.sessionVersion,
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1h" }
    )
}
export const Auditor = mongoose.model("Auditor", auditorSchema)
