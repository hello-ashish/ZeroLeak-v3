import mongoose, { Schema } from "mongoose"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

const adminSchema = new Schema(
    {
        adminId: { type: String, required: true, unique: true },
        name: { type: String, trim: true, default: "" },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: [true, "Password is required"] },
        lastActiveAt: { type: Date, default: null },
        isLoggedIn: { type: Boolean, default: false },
        sessionVersion: { type: Number, default: 0 },
        isSupport: { type: Boolean, default: false, index: true },
        isBlocked: { type: Boolean, default: false }
    }, { timestamps: true }
)

adminSchema.index({ isSupport: 1, createdAt: -1 });

adminSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 10)
})

adminSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)
}

adminSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            id: this._id,
            email: this.email,
            role: "Admin",
            sessionVersion: this.sessionVersion,
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1h" }
    )
}
export const Admin = mongoose.model("Admin", adminSchema)