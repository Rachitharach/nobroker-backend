
const mongoose = require("mongoose");

const meetingRequestSchema = new mongoose.Schema(
    {
        userPhone: {
            type: String,
            required: true,
            index: true,
        },

        subscriptionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CommercialTenantSubscription",
            required: true,
        },

        propertyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Property",
            required: true,
        },

        name: {
            type: String,
            required: true,
            trim: true,
        },

        phone: {
            type: String,
            required: true,
            trim: true,
        },

        preferredDate: {
            type: String,
            required: true,
        },

        preferredTime: {
            type: String,
            required: true,
        },

        message: {
            type: String,
            default: "",
        },

        status: {
            type: String,
            enum: [
                "Pending",
                "AwaitingUserResponse",
                "Confirmed",
                "Completed",
                "Cancelled",
            ],
            default: "Pending",
        },

        adminResponse: {
            type: String,
            default: "",
        },

        suggestedDate: {
            type: String,
            default: "",
        },

        suggestedTime: {
            type: String,
            default: "",
        },

        confirmedDate: {
            type: String,
            default: "",
        },

        confirmedTime: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("MeetingRequest", meetingRequestSchema);
