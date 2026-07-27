import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const platformOwnerSchema = new mongoose.Schema(
    {
        name:     { type: String, required: true, trim: true },
        email:    { type: String, required: true, unique: true, trim: true, lowercase: true },
        password: { type: String, required: true, minlength: 8, select: false },
        phone:    { type: String, trim: true, default: null },
        isActive: { type: Boolean, default: true },

        passwordResetToken:   { type: String, select: false },
        passwordResetExpires: { type: Date, select: false },
        lastLogin:            { type: Date, default: null },
    },
    { timestamps: true }
);

platformOwnerSchema.pre("save", async function () {
    if (!this.isModified("password") || !this.password) return;
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

platformOwnerSchema.methods.comparePassword = async function (candidate) {
    return bcrypt.compare(candidate, this.password);
};

export default mongoose.model("PlatformOwner", platformOwnerSchema);
