const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
    {
        userPhone: {
            type: String,
            required: true,
            unique: true,
        },

        remainingContacts: {
            type: Number,
            default: 0,
        },

        totalContactsPurchased: {
            type: Number,
            default: 0,
        },

        totalContactsUsed: {
            type: Number,
            default: 0,
        },

        unlockedPropertyIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Property",
            },
        ],

        // Prevent the same payment from adding contacts twice
        creditedPaymentIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Payment",
            },
        ],
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);