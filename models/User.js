const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        phone: {
            type: String,
            required: true,
            unique: true,
        },
        name: {
            type: String,
            default: "",
        },
        email: {
            type: String,
            default: "",
            lowercase: true,
            trim: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);