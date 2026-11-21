const Razorpay = require("razorpay");
const crypto = require("crypto");

const Payment = require("../models/Payment");
const Subscription = require("../models/Subscription");
const CommercialTenantSubscription = require("../models/CommercialTenantSubscription");
const Property = require("../models/Property");
const MeetingRequest = require("../models/MettingRequest");
const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Razorpay connection
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Existing Buyer / Owner plans
const plans = {
    power: {
        name: "Power",
        price: 1899,
        contacts: 3,
    },

    expert: {
        name: "Expert",
        price: 1999,
        contacts: 5,
    },

    moneyback: {
        name: "Moneyback",
        price: 4999,
        contacts: 7,
    },
};

// New Commercial Tenant plans
const commercialTenantPlans = {
    freedom: {
        name: "Freedom",
        price: 1499,
        meetingLimit: 2,
        validityDays: 90,
    },

    relax: {
        name: "Relax",
        price: 2999,
        meetingLimit: 3,
        validityDays: 45,
    },

    "super-relax": {
        name: "Super Relax",
        price: 7499,
        meetingLimit: 5,
        validityDays: 45,
    },
};

const GST_RATE = 0.18;


// 1. Create Razorpay order
exports.createOrder = (req, res) => {
    const planId = req.body.planId;
    const planType = req.body.planType || "Buyer";
    if (planType === "CommercialTenant") {
    return res.status(400).json({
        success: false,
        message: "Commercial Tenant payments must use Stripe.",
    });
}

    let selectedPlan;

    if (planType === "CommercialTenant") {
        selectedPlan = commercialTenantPlans[planId];
    } else {
        selectedPlan = plans[planId];
    }

    if (!selectedPlan) {
        return res.status(400).json({
            success: false,
            message: "Invalid subscription plan",
        });
    }

    const baseAmount = selectedPlan.price;
    const gstAmount = Number((baseAmount * GST_RATE).toFixed(2));
    const totalAmount = Number((baseAmount + gstAmount).toFixed(2));

    const options = {
        amount: Math.round(totalAmount * 100),
        currency: "INR",
        receipt: "receipt_" + Date.now(),
    };

    razorpay.orders.create(options)
        .then((order) => {
            return Payment.create({
                userPhone: req.user.phone,
                planType: planType,
                planId: planId,
                planName: selectedPlan.name,

                // Base plan price
                amount: baseAmount,

                // GST and final amount
                gstAmount: gstAmount,
                totalAmount: totalAmount,

                // Buyer / Owner contact limit
                contactLimit:
                    planType === "CommercialTenant"
                        ? 0
                        : selectedPlan.contacts,

                // Commercial Tenant meeting details
                meetingLimit:
                    planType === "CommercialTenant"
                        ? selectedPlan.meetingLimit
                        : 0,

                validityDays:
                    planType === "CommercialTenant"
                        ? selectedPlan.validityDays
                        : 0,

                razorpayOrderId: order.id,
                status: "Pending",
            }).then((payment) => {
                return res.status(200).json({
                    success: true,
                    message: "Payment order created",
                    orderId: order.id,
                    amount: order.amount,
                    currency: order.currency,
                    keyId: process.env.RAZORPAY_KEY_ID,
                    paymentId: payment._id,
                    baseAmount: baseAmount,
                    gstAmount: gstAmount,
                    totalAmount: totalAmount,
                });
            });
        })
        .catch((error) => {
            console.log("Create order error:", error);

            return res.status(500).json({
                success: false,
                message: "Could not create payment order",
            });
        });
};


// Create Stripe Checkout Session for Commercial Tenant
exports.createCommercialTenantCheckout = (req, res) => {
    const planId = req.body.planId;

    const selectedPlan = commercialTenantPlans[planId];

    if (!selectedPlan) {
        return res.status(400).json({
            success: false,
            message: "Invalid Commercial Tenant plan",
        });
    }

    const baseAmount = selectedPlan.price;
    const gstAmount = Number((baseAmount * GST_RATE).toFixed(2));
    const totalAmount = Number((baseAmount + gstAmount).toFixed(2));

    // First create a pending payment record
    Payment.create({
        userPhone: req.user.phone,
        planType: "CommercialTenant",
        paymentProvider: "Stripe",
        planId: planId,
        planName: selectedPlan.name,
        amount: baseAmount,
        gstAmount: gstAmount,
        totalAmount: totalAmount,
        contactLimit: 0,
        meetingLimit: selectedPlan.meetingLimit,
        validityDays: selectedPlan.validityDays,
        status: "Pending",
    })
        .then((payment) => {
            return stripe.checkout.sessions.create({
                mode: "payment",

                line_items: [
                    {
                        price_data: {
                            currency: "inr",
                            product_data: {
                                name: selectedPlan.name + " Commercial Tenant Plan",
                                description:
                                    "Plan price ₹" + baseAmount +
                                    " + GST ₹" + gstAmount,
                            },
                            unit_amount: Math.round(totalAmount * 100),
                        },
                        quantity: 1,
                    },
                ],

                metadata: {
                    paymentId: payment._id.toString(),
                    userPhone: req.user.phone,
                    planType: "CommercialTenant",
                    planId: planId,
                },

                success_url:
                    process.env.FRONTEND_URL +
                    "/commercial-tenant-plans?payment=success",

                cancel_url:
                    process.env.FRONTEND_URL +
                    "/commercial-tenant-plans?payment=cancelled",
            })
                .then((session) => {
                    payment.stripeCheckoutSessionId = session.id;

                    return payment.save().then(() => {
                        return res.status(200).json({
                            success: true,
                            message: "Stripe Checkout Session created",
                            sessionId: session.id,
                            checkoutUrl: session.url,
                            paymentId: payment._id,
                            baseAmount: baseAmount,
                            gstAmount: gstAmount,
                            totalAmount: totalAmount,
                        });
                    });
                })
                .catch((error) => {
                    payment.status = "Failed";

                    return payment.save().then(() => {
                        throw error;
                    });
                });
        })
        .catch((error) => {
            console.log("Stripe checkout error:", error);

            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    message: "Could not create Stripe Checkout Session",
                });
            }
        });
};


// 2. Verify Razorpay payment
exports.verifyPayment = (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
    } = req.body;

    if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature
    ) {
        return res.status(400).json({
            success: false,
            message: "Payment details are missing",
        });
    }

    Payment.findOne({
        razorpayOrderId: razorpay_order_id,
        userPhone: req.user.phone,
    })
        .then((payment) => {
            if (!payment) {
                return res.status(404).json({
                    success: false,
                    message: "Payment order not found",
                });
            }
            if (payment.status === "Success") {
            return res.status(200).json({
                received: true,
                success: true,
                message: "Payment already processed",
            });
        }

            // Commercial Tenant payments must be verified by Stripe webhook
            if (payment.planType === "CommercialTenant") {
                return res.status(400).json({
                    success: false,
                    message: "Commercial Tenant payments must use Stripe.",
                });
            }

            // Already verified
            // if (payment.status === "Success") {
            //     if (payment.planType === "CommercialTenant") {
            //         return CommercialTenantSubscription.findOne({
            //             paymentId: payment._id,
            //         }).then((subscription) => {
            //             return res.status(200).json({
            //                 success: true,
            //                 message: "Payment already verified",
            //                 subscription: subscription,
            //             });
            //         });
            //     }

            //     return Subscription.findOne({
            //         userPhone: req.user.phone,
            //     }).then((subscription) => {
            //         return res.status(200).json({
            //             success: true,
            //             message: "Payment already verified",
            //             subscription: subscription,
            //         });
            //     });
            // }

            // Verify Razorpay signature
            const generatedSignature = crypto
                .createHmac(
                    "sha256",
                    process.env.RAZORPAY_KEY_SECRET
                )
                .update(
                    razorpay_order_id + "|" + razorpay_payment_id
                )
                .digest("hex");

            const signatureBuffer = Buffer.from(generatedSignature);
            const receivedBuffer = Buffer.from(razorpay_signature);

            const signatureValid =
                signatureBuffer.length === receivedBuffer.length &&
                crypto.timingSafeEqual(
                    signatureBuffer,
                    receivedBuffer
                );

            if (!signatureValid) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid payment signature",
                });
            }

            // -----------------------------------------
            // COMMERCIAL TENANT PAYMENT
            // -----------------------------------------
            if (payment.planType === "CommercialTenant") {
                const startDate = new Date();

                const expiresAt = new Date(startDate);
                expiresAt.setDate(
                    expiresAt.getDate() + payment.validityDays
                );

                return CommercialTenantSubscription.findOneAndUpdate(
                    {
                        paymentId: payment._id,
                    },
                    {
                        $setOnInsert: {
                            userPhone: req.user.phone,
                            paymentId: payment._id,
                            planId: payment.planId,
                            planName: payment.planName,
                            meetingLimit: payment.meetingLimit,
                            validityDays: payment.validityDays,
                            startDate: startDate,
                            expiresAt: expiresAt,
                            requestedPropertyIds: [],
                            status: "Active",
                        },
                    },
                    {
                        new: true,
                        upsert: true,
                        setDefaultsOnInsert: true,
                    }
                ).then((subscription) => {
                    payment.razorpayPaymentId = razorpay_payment_id;
                    payment.razorpaySignature = razorpay_signature;
                    payment.status = "Success";

                    return payment.save().then(() => {
                        return res.status(200).json({
                            success: true,
                            message: "Commercial Tenant payment successful. Subscription activated.",
                            subscription: subscription,
                            planType: "CommercialTenant",
                        });
                    });
                });
            }

            // -----------------------------------------
            // EXISTING BUYER / OWNER PAYMENT
            // -----------------------------------------

            return Subscription.findOneAndUpdate(
                {
                    userPhone: req.user.phone,
                    creditedPaymentIds: {
                        $ne: payment._id,
                    },
                },
                {
                    $inc: {
                        remainingContacts: payment.contactLimit,
                        totalContactsPurchased: payment.contactLimit,
                    },

                    $addToSet: {
                        creditedPaymentIds: payment._id,
                    },

                    $setOnInsert: {
                        userPhone: req.user.phone,
                    },
                },
                {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true,
                }
            )
                .catch((error) => {
                    if (error.code === 11000) {
                        return Subscription.findOne({
                            userPhone: req.user.phone,
                        });
                    }

                    throw error;
                })
                .then((subscription) => {
                    if (!subscription) {
                        throw new Error(
                            "Subscription could not be updated"
                        );
                    }

                    payment.razorpayPaymentId = razorpay_payment_id;
                    payment.razorpaySignature = razorpay_signature;
                    payment.status = "Success";

                    return payment.save().then(() => {
                        return res.status(200).json({
                            success: true,
                            message: "Payment successful. Subscription activated.",
                            subscription: subscription,
                            remainingContacts: subscription.remainingContacts,
                            totalContactsPurchased: subscription.totalContactsPurchased,
                        });
                    });
                });
        })
        .catch((error) => {
            console.log("Payment verification error:", error);

            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    message: "Payment verification failed",
                });
            }
        });
};


// 3. Get user's Buyer / Owner subscription
exports.getMySubscription = (req, res) => {
    Subscription.findOne({
        userPhone: req.user.phone
    })
        .then((subscription) => {
            return res.status(200).json({
                success: true,
                subscription: subscription,
                remainingContacts: subscription
                    ? subscription.remainingContacts
                    : 0,
                totalContactsPurchased: subscription
                    ? subscription.totalContactsPurchased
                    : 0
            });
        })
        .catch((error) => {
            console.log("Get subscription error:", error);

            return res.status(500).json({
                success: false,
                message: "Could not fetch subscription"
            });
        });
};

// Get logged-in user's current Commercial Tenant subscription
exports.getMyCommercialTenantPlan = (req, res) => {

    CommercialTenantSubscription.findOne({
        userPhone: req.user.phone,
    })
        .sort({ createdAt: -1, _id: -1 })
        .then((subscription) => {

            if (!subscription) {
                return res.status(200).json({
                    success: true,
                    hasActivePlan: false,
                    subscription: null,
                    requestedCount: 0,
                    meetingLimit: 0,
                    remainingMeetings: 0,
                    pendingAdminResponses: 0,
                    allResponsesReceived: false,
                    message: "No Commercial Tenant subscription found.",
                });
            }

            const requestedCount =
                subscription.requestedPropertyIds?.length || 0;

            const meetingLimit = subscription.meetingLimit;

            // 1. Check expiry first
            if (new Date(subscription.expiresAt) <= new Date()) {

                subscription.status = "Expired";

                return subscription.save().then(() => {
                    return res.status(200).json({
                        success: true,
                        hasActivePlan: false,
                        subscription,
                        requestedCount,
                        meetingLimit,
                        remainingMeetings: Math.max(
                            0,
                            meetingLimit - requestedCount
                        ),
                        pendingAdminResponses: 0,
                        allResponsesReceived: false,
                        message:
                            "Your subscription has expired. Please choose another plan.",
                    });
                });
            }

            // 2. Count meeting requests still requiring action
            return MeetingRequest.countDocuments({
                subscriptionId: subscription._id,
                status: {
                    $in: [
                        "Pending",
                        "AwaitingUserResponse",
                    ],
                },
            }).then((pendingAdminResponses) => {

                // 3. Decide subscription status
                if (requestedCount >= meetingLimit) {
                    subscription.status = "LimitReached";
                } else {
                    subscription.status = "Active";
                }

                const allResponsesReceived =
                    requestedCount >= meetingLimit &&
                    pendingAdminResponses === 0;

                return subscription.save().then(() => {

                    const hasActivePlan =
                        subscription.status === "Active";

                    return res.status(200).json({
                        success: true,

                        hasActivePlan,

                        subscription,

                        requestedCount,

                        meetingLimit,

                        remainingMeetings: Math.max(
                            0,
                            meetingLimit - requestedCount
                        ),

                        pendingAdminResponses,

                        allResponsesReceived,

                        message: allResponsesReceived
                            ? "Your meeting request limit is over. Please choose a plan to continue."
                            : hasActivePlan
                                ? "Your Commercial Tenant plan is active."
                                : "Your subscription is not active.",
                    });
                });
            });
        })
        .catch((error) => {

            console.log("Commercial Tenant plan error:", error);

            return res.status(500).json({
                success: false,
                message: "Could not fetch Commercial Tenant plan.",
            });
        });
};



// 4. Unlock owner details
exports.getOwnerDetails = (req, res) => {
    const propertyId = req.params.id;
    const userPhone = req.user.phone;

    Property.findOne({
        _id: propertyId,
        status: { $in: ["Approved", null] },
        isActive: { $ne: false },
    })
        .then((property) => {
            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: "Property not found",
                });
            }

            return Subscription.findOne({
                userPhone: userPhone,
            }).then((subscription) => {

                if (!subscription) {
                    return res.status(403).json({
                        success: false,
                        message: "Please purchase a subscription first",
                    });
                }

                // Check whether property is already unlocked
                const alreadyUnlocked =
                    subscription.unlockedPropertyIds.some(
                        (id) => id.toString() === propertyId
                    );

                if (alreadyUnlocked) {
                    return res.status(200).json({
                        success: true,
                        message: "Property already unlocked",
                        owner: {
                            name: property.contact?.name || property.ownerName,
                            phone: property.contact?.mobile || property.ownerPhone,
                            email: property.contact?.email,
                        },
                        remainingContacts: subscription.remainingContacts,
                    });
                }

                // Check contact balance
                if (subscription.remainingContacts <= 0) {
                    return res.status(403).json({
                        success: false,
                        message: "Your contact limit is over. Please purchase another plan.",
                        remainingContacts: 0,
                    });
                }

                // Deduct one contact and unlock property
                return Subscription.findOneAndUpdate(
                    {
                        userPhone: userPhone,
                        remainingContacts: { $gt: 0 },
                        unlockedPropertyIds: { $ne: property._id },
                    },
                    {
                        $inc: {
                            remainingContacts: -1,
                            totalContactsUsed: 1,
                        },

                        $addToSet: {
                            unlockedPropertyIds: property._id,
                        },
                    },
                    {
                        new: true,
                    }
                ).then((updatedSubscription) => {

                    if (!updatedSubscription) {
                        return Subscription.findOne({
                            userPhone: userPhone,
                        }).then((latestSubscription) => {

                            const isUnlocked =
                                latestSubscription &&
                                latestSubscription.unlockedPropertyIds.some(
                                    (id) => id.toString() === propertyId
                                );

                            if (isUnlocked) {
                                return res.status(200).json({
                                    success: true,
                                    message: "Property already unlocked",
                                    owner: {
                                        name: property.contact?.name || property.ownerName,
                                        phone: property.contact?.mobile || property.ownerPhone,
                                        email: property.contact?.email,
                                    },
                                    remainingContacts: latestSubscription.remainingContacts,
                                });
                            }

                            return res.status(403).json({
                                success: false,
                                message: "No contacts remaining. Please purchase another plan.",
                                remainingContacts: 0,
                            });
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        message: "Owner details unlocked successfully",
                        owner: {
                            name: property.contact?.name || property.ownerName,
                            phone: property.contact?.mobile || property.ownerPhone,
                            email: property.contact?.email,
                        },
                        remainingContacts: updatedSubscription.remainingContacts,
                        totalContactsUsed: updatedSubscription.totalContactsUsed,
                    });
                });
            });
        })
        .catch((error) => {
            console.log("Owner details error:", error);

            return res.status(500).json({
                success: false,
                message: "Could not unlock owner details",
            });
        });
};


// Stripe webhook: activate Commercial Tenant subscription


exports.stripeWebhook = (req, res) => {
    console.log("========== STRIPE WEBHOOK RECEIVED ==========");
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Body is Buffer:", Buffer.isBuffer(req.body));
    console.log("Stripe signature exists:", !!req.headers["stripe-signature"]);

    

    const signature = req.headers["stripe-signature"];

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
        console.log("Stripe webhook signature error:", error.message);

        return res.status(400).send("Invalid Stripe webhook signature");
    }
    console.log("Stripe webhook signature verified successfully");
    console.log("Event type:", event.type);

        if (
            event.type !== "checkout.session.completed" &&
            event.type !== "checkout.session.async_payment_succeeded"
        ) {
            return res.status(200).json({
                received: true,
            });
        }

    const session = event.data.object;

    if (session.payment_status !== "paid") {
        return res.status(200).json({
            received: true,
            message: "Payment is not completed",
        });
    }

    const paymentId = session.metadata?.paymentId;

    console.log("Stripe metadata:", session.metadata);
    console.log("Payment ID:", paymentId);

    if (!paymentId) {
        return res.status(400).send("Payment ID missing in Stripe metadata");
    }

    Payment.findOne({
        _id: paymentId,
        stripeCheckoutSessionId: session.id,
        paymentProvider: "Stripe",
        planType: "CommercialTenant",
    })
        .then((payment) => {
            if (!payment) {
                return res.status(404).send("Payment record not found");
            }

            const startDate = new Date();
            const expiresAt = new Date(startDate);

            expiresAt.setDate(
                expiresAt.getDate() + payment.validityDays
            );

            // Create subscription only once for this payment
            return CommercialTenantSubscription.findOneAndUpdate(
                {
                    paymentId: payment._id,
                },
                {
                    $setOnInsert: {
                        userPhone: payment.userPhone,
                        paymentId: payment._id,
                        planId: payment.planId,
                        planName: payment.planName,
                        meetingLimit: payment.meetingLimit,
                        validityDays: payment.validityDays,
                        startDate: startDate,
                        expiresAt: expiresAt,
                        requestedPropertyIds: [],
                        status: "Active",
                    },
                },
                {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true,
                }
            ).then((subscription) => {
                payment.stripePaymentIntentId =
                    session.payment_intent || null;

                payment.status = "Success";

                return payment.save().then(() => {
                    console.log(
                        "Commercial Tenant Stripe payment successful:",
                        payment._id
                    );

                    return res.status(200).json({
                        received: true,
                        success: true,
                        message: "Commercial Tenant subscription activated",
                        subscription: subscription,
                    });
                });
            });
        })
        .catch((error) => {
            console.log("Stripe webhook processing error:", error);

            return res.status(500).send("Webhook processing failed");
        });
};
