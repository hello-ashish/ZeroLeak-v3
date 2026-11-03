import mongoose, { Schema } from "mongoose"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

const professorSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        contact: { type: String, trim: true },
        address: { type: String, trim: true },
        password: { type: String, required: [true, "Password is required"] },
        lastActiveAt: { type: Date, default: null },
        isLoggedIn: { type: Boolean, default: false },
        isBlocked: { type: Boolean, default: false },
        sessionVersion: { type: Number, default: 0 }
    }, { timestamps: true }
)

professorSchema.index({ name: 'text', email: 'text' });
professorSchema.index({ createdAt: -1 });
professorSchema.index({ isBlocked: 1 });

professorSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 10)
})

professorSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)
}

professorSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            id: this._id,
            email: this.email,
            role: "Professor",
            sessionVersion: this.sessionVersion,
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1h" }
    )
}

export const Professor = mongoose.model("Professor", professorSchema)