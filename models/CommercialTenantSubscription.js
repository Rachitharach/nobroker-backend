const mongoose = require("mongoose");

const commercialTenantSubscriptionSchema = new mongoose.Schema(
    {
        userPhone: {
            type: String,
            required: true,
            index: true,
        },

        // Link to the successful payment
        paymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Payment",
            required: true,
            unique: true,
        },

        planId: {
            type: String,
            enum: ["freedom", "relax", "super-relax"],
            required: true,
        },

        planName: {
            type: String,
            required: true,
        },

        // Number of distinct properties for which meetings can be requested
        meetingLimit: {
            type: Number,
            required: true,
        },

        // Subscription validity in days
        validityDays: {
            type: Number,
            required: true,
        },

        startDate: {
            type: Date,
            required: true,
            default: Date.now,
        },

        expiresAt: {
            type: Date,
            required: true,
        },

        // Stores distinct property IDs for which the user has requested meetings
        requestedPropertyIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Property",
            },
        ],

        status: {
            type: String,
            enum: ["Active", "Expired", "LimitReached"],
            default: "Active",
        },
    },
    {
        timestamps: true,
    }
);



module.exports = mongoose.model(
    "CommercialTenantSubscription",
    commercialTenantSubscriptionSchema
);