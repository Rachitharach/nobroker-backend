
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
    {
        userPhone: {
            type: String,
            required: true,
            index: true,
        },

        // Identifies which type of plan was purchased
        planType: {
            type: String,
            enum: ["Buyer", "Owner", "CommercialTenant"],
            default: "Buyer",
            required: true,
        },

        // Payment gateway used
        paymentProvider: {
            type: String,
            enum: ["Razorpay", "Stripe"],
            default: "Razorpay",
            required: true,
        },

        planId: {
            type: String,
            required: true,
        },

        planName: {
            type: String,
            required: true,
        },

        // Original plan price before GST
        amount: {
            type: Number,
            required: true,
        },

        // GST amount
        gstAmount: {
            type: Number,
            default: 0,
        },

        // Final amount including GST
        totalAmount: {
            type: Number,
            default: 0,
        },

        // Buyer / Owner contact limit
        contactLimit: {
            type: Number,
            default: 0,
        },

        // Commercial Tenant meeting limit
        meetingLimit: {
            type: Number,
            default: 0,
        },

        // Commercial Tenant plan validity
        validityDays: {
            type: Number,
            default: 0,
        },

        // Razorpay payment details
        razorpayOrderId: {
            type: String,
            sparse: true,
            unique: true,
        },

        razorpayPaymentId: {
            type: String,
            default: null,
        },

        razorpaySignature: {
            type: String,
            default: null,
        },

        // Stripe payment details
        stripeCheckoutSessionId: {
            type: String,
            sparse: true,
            unique: true,
        },

        stripePaymentIntentId: {
            type: String,
            default: null,
        },

        status: {
            type: String,
            enum: ["Pending", "Success", "Failed"],
            default: "Pending",
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Payment", paymentSchema);
