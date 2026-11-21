
const MeetingRequest = require("../models/MettingRequest")
const CommercialTenantSubscription = require("../models/CommercialTenantSubscription");
const Property = require("../models/Property");


// Meeting statuses that still require action before the cycle is complete
const UNRESOLVED_MEETING_STATUSES = [
    "Pending",
    "AwaitingUserResponse",
];

// Update subscription status based on meeting responses
function syncSubscriptionStatus(subscriptionId) {
    return CommercialTenantSubscription.findById(subscriptionId)
        .then((subscription) => {
            if (!subscription) {
                return null;
            }

            // Expiry takes priority
            if (new Date(subscription.expiresAt) <= new Date()) {
                subscription.status = "Expired";
                return subscription.save();
            }

            const requestedCount =
                subscription.requestedPropertyIds?.length || 0;

            // Only check response completion after the request limit is reached
            if (requestedCount >= subscription.meetingLimit) {
                return MeetingRequest.countDocuments({
                    subscriptionId: subscription._id,
                    status: {
                        $in: UNRESOLVED_MEETING_STATUSES,
                    },
                }).then((unresolvedCount) => {
                    subscription.status =
                        unresolvedCount === 0
                            ? "LimitReached"
                            : "Active";

                    return subscription.save();
                });
            }

            subscription.status = "Active";
            return subscription.save();
        });
}

// Check whether the requested date matches the owner's available days
function checkOwnerAvailability(property, preferredDate) {
    if (!property.visitDays || !preferredDate) {
        return false;
    }

    // Use midday to avoid timezone date changes
    const date = new Date(`${preferredDate}T12:00:00`);

    if (isNaN(date.getTime())) {
        return false;
    }

    const day = date.getDay(); // Sunday = 0, Saturday = 6

    if (property.visitDays === "Everyday") {
        return true;
    }

    if (property.visitDays === "Weekdays") {
        return day >= 1 && day <= 5;
    }

    if (property.visitDays === "Weekends") {
        return day === 0 || day === 6;
    }

    return false;
}

// 1. USER SUBMITS A MEETING REQUEST
exports.createMeetingRequest = (req, res) => {
    const {
        propertyId,
        preferredDate,
        preferredTime,
        name,
        phone,
        message,
        meetingRequestId,
    } = req.body;

    if (
        !propertyId ||
        !preferredDate ||
        !preferredTime ||
        !name ||
        !phone
    ) {
        return res.status(400).json({
            success: false,
            message: "Please fill all required meeting details.",
        });
    }

    if (!/^\d{10}$/.test(phone)) {
        return res.status(400).json({
            success: false,
            message: "Please enter a valid 10-digit phone number.",
        });
    }

    const userPhone = req.user.phone;

    // Always use the latest purchased subscription
    CommercialTenantSubscription.findOne({
        userPhone: userPhone,
    })
        .sort({ createdAt: -1, _id: -1 })
        .then((subscription) => {
            if (!subscription) {
                return res.status(403).json({
                    success: false,
                    message: "Please purchase a Commercial Tenant plan first.",
                });
            }

            return syncSubscriptionStatus(subscription._id)
                .then((subscription) => {

                    if (
                        !subscription ||
                        subscription.status !== "Active"
                    ) {
                        return res.status(403).json({
                            success: false,
                            message:
                                subscription?.status === "Expired"
                                    ? "Your subscription has expired. Please choose another plan."
                                    : "Your meeting request limit is over. Please choose another plan.",
                        });
                    }

                    // RESUBMIT AN EXISTING REQUEST
                    if (meetingRequestId) {
                        return MeetingRequest.findOne({
                            _id: meetingRequestId,
                            userPhone: userPhone,
                            subscriptionId: subscription._id,
                            status: "AwaitingUserResponse",
                        }).then((meetingRequest) => {

                            if (!meetingRequest) {
                                return res.status(404).json({
                                    success: false,
                                    message:
                                        "Meeting request not found or no longer awaiting your response.",
                                });
                            }

                            if (
                                meetingRequest.propertyId.toString() !==
                                propertyId.toString()
                            ) {
                                return res.status(400).json({
                                    success: false,
                                    message:
                                        "Property does not match this meeting request.",
                                });
                            }

                            meetingRequest.preferredDate = preferredDate;
                            meetingRequest.preferredTime = preferredTime;
                            meetingRequest.name = name.trim();
                            meetingRequest.phone = phone;
                            meetingRequest.message = message || "";

                            meetingRequest.status = "Pending";
                            meetingRequest.adminResponse = "";

                            meetingRequest.suggestedDate = "";
                            meetingRequest.suggestedTime = "";
                            meetingRequest.confirmedDate = "";
                            meetingRequest.confirmedTime = "";

                            return meetingRequest.save()
                                .then((updatedRequest) => {
                                    return syncSubscriptionStatus(
                                        subscription._id
                                    ).then(() => {
                                        return res.status(200).json({
                                            success: true,
                                            message:
                                                "Your new meeting date has been submitted successfully.",
                                            meetingRequest: updatedRequest,
                                        });
                                    });
                                });
                        });
                    }

                    // CHECK MEETING LIMIT
                    const alreadyRequested =
                        subscription.requestedPropertyIds.some(
                            (id) => id.toString() === propertyId.toString()
                        );

                    if (
                        !alreadyRequested &&
                        subscription.requestedPropertyIds.length >=
                            subscription.meetingLimit
                    ) {
                        return res.status(403).json({
                            success: false,
                            message:
                                "Your meeting request limit is reached. Please wait for the pending meeting updates.",
                            requestedCount:
                                subscription.requestedPropertyIds.length,
                            meetingLimit: subscription.meetingLimit,
                        });
                    }

                    // VERIFY COMMERCIAL RENTAL PROPERTY
                    return Property.findOne({
                        _id: propertyId,
                        type: "Commercial",
                        adType: "Rent",
                        status: "Approved",
                        isActive: { $ne: false },
                    }).then((property) => {

                        if (!property) {
                            return res.status(404).json({
                                success: false,
                                message:
                                    "Commercial rental property not found.",
                            });
                        }

                        return MeetingRequest.create({
                            userPhone: userPhone,
                            subscriptionId: subscription._id,
                            propertyId: property._id,
                            name: name.trim(),
                            phone: phone,
                            preferredDate: preferredDate,
                            preferredTime: preferredTime,
                            message: message || "",
                            status: "Pending",
                        }).then((meetingRequest) => {

                            if (!alreadyRequested) {
                                subscription.requestedPropertyIds.push(
                                    property._id
                                );
                            }

                            return subscription.save()
                                .then(() =>
                                    syncSubscriptionStatus(subscription._id)
                                )
                                .then((updatedSubscription) => {
                                    return res.status(201).json({
                                        success: true,
                                        message:
                                            "Meeting request submitted successfully. Our team will contact you.",
                                        meetingRequest: meetingRequest,
                                        requestedCount:
                                            updatedSubscription
                                                .requestedPropertyIds.length,
                                        meetingLimit:
                                            updatedSubscription.meetingLimit,
                                        subscriptionStatus:
                                            updatedSubscription.status,
                                    });
                                });
                        });
                    });
                });
        })
        .catch((error) => {
            console.log("Create meeting request error:", error);

            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    message: "Could not submit meeting request.",
                });
            }
        });
};

// 2. USER VIEWS THEIR OWN MEETING REQUESTS
// USER VIEWS THEIR MEETING REQUESTS
exports.getMyMeetingRequests = (req, res) => {

    // Profile history should retain all previous requests
    if (req.query.currentPlan !== "true") {
        return MeetingRequest.find({
            userPhone: req.user.phone,
        })
            .populate("propertyId")
            .populate("subscriptionId")
            .sort({ createdAt: -1 })
            .then((requests) => {
                return res.status(200).json({
                    success: true,
                    count: requests.length,
                    requests: requests,
                });
            })
            .catch((error) => {
                console.log("My meeting requests error:", error);

                return res.status(500).json({
                    success: false,
                    message: "Could not fetch your meeting requests.",
                });
            });
    }

    // Commercial Tenant page: only latest subscription
    CommercialTenantSubscription.findOne({
        userPhone: req.user.phone,
    })
        .sort({ createdAt: -1, _id: -1 })
        .then((subscription) => {

            if (!subscription) {
                return res.status(200).json({
                    success: true,
                    count: 0,
                    requests: [],
                    subscriptionId: null,
                });
            }

            return MeetingRequest.find({
                userPhone: req.user.phone,
                subscriptionId: subscription._id,
            })
                .populate("propertyId")
                .sort({ createdAt: -1 })
                .then((requests) => {
                    return res.status(200).json({
                        success: true,
                        count: requests.length,
                        requests: requests,
                        subscriptionId: subscription._id,
                    });
                });
        })
        .catch((error) => {
            console.log("Current meeting requests error:", error);

            return res.status(500).json({
                success: false,
                message: "Could not fetch your meeting requests.",
            });
        });
};


// 3. ADMIN VIEWS ALL MEETING REQUESTS
exports.getAllMeetingRequests = (req, res) => {
    MeetingRequest.find()
        .populate("propertyId")
        .populate("subscriptionId")
        .sort({ createdAt: -1 })
        .then((requests) => {
            return res.status(200).json({
                success: true,
                count: requests.length,
                requests: requests,
            });
        })
        .catch((error) => {
            console.log("Admin meeting requests error:", error);

            return res.status(500).json({
                success: false,
                message: "Could not fetch meeting requests.",
            });
        });
};


// 4. ADMIN RESPONDS TO A MEETING REQUEST
exports.respondToMeetingRequest = (req, res) => {
    const { id } = req.params;

    const {
        action,
        adminResponse,
        suggestedDate,
        suggestedTime,
        confirmedDate,
        confirmedTime,
    } = req.body;

    if (!["Confirmed", "AwaitingUserResponse", "Cancelled"].includes(action)) {
        return res.status(400).json({
            success: false,
            message: "Invalid meeting response action.",
        });
    }

    if (
        action === "AwaitingUserResponse" &&
        ((suggestedDate && !suggestedTime) ||
        (!suggestedDate && suggestedTime))
    ) {
        return res.status(400).json({
            success: false,
            message: "Please provide an alternative date and time.",
        });
    }

    if (
        action === "Confirmed" &&
        (!confirmedDate || !confirmedTime)
    ) {
        return res.status(400).json({
            success: false,
            message: "Please provide the confirmed meeting date and time.",
        });
    }

    MeetingRequest.findById(id)
        .then((meetingRequest) => {
            if (!meetingRequest) {
                return res.status(404).json({
                    success: false,
                    message: "Meeting request not found.",
                });
            }


            // Check owner's available days before confirming the meeting
if (action === "Confirmed") {
    return Property.findById(meetingRequest.propertyId)
        .then(property => {
            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: "Property not found."
                });
            }

            console.log("OWNER VISIT DAYS:", property.visitDays);
            console.log("CONFIRMED DATE:", confirmedDate);
            console.log("PREFERRED DATE:", meetingRequest.preferredDate);
            console.log("PROPERTY AVAILABILITY:", property);

            const isAvailable = checkOwnerAvailability(
                property,
                confirmedDate || meetingRequest.preferredDate
            );

if (!isAvailable) {
    let message = "";

    if (!property.visitDays) {
        message =
            "The owner's availability is not updated for this property. We cannot confirm your selected date. Please choose another day after checking with our team.";
    } else if (property.visitDays === "Weekdays") {
        message =
            "The owner is not available on weekends. Please choose a weekday (Monday to Friday).";
    } else if (property.visitDays === "Weekends") {
        message =
            "The owner is not available on weekdays. Please choose a weekend (Saturday or Sunday).";
    } else {
        message =
            "The owner is not available on your selected date. Please choose another date.";
    }

    meetingRequest.status = "AwaitingUserResponse";
    meetingRequest.adminResponse = message;

return meetingRequest.save().then((updatedRequest) => {
    return syncSubscriptionStatus(
        updatedRequest.subscriptionId
    ).then(() => {
        return res.status(200).json({
            success: true,
            message: "Meeting request updated successfully.",
            meetingRequest: updatedRequest,
        });
    });
});
}

            // Continue with your existing confirmation code
            meetingRequest.status = action;
            meetingRequest.adminResponse = adminResponse || "";
            meetingRequest.confirmedDate = confirmedDate || meetingRequest.preferredDate;
            meetingRequest.confirmedTime = confirmedTime || meetingRequest.preferredTime;

            return meetingRequest.save().then(updatedRequest => {
                return res.status(200).json({
                    success: true,
                    message: "Meeting confirmed successfully.",
                    meetingRequest: updatedRequest
                });
            });
        });
}

            meetingRequest.status = action;
            meetingRequest.adminResponse = adminResponse || "";

            if (action === "AwaitingUserResponse") {
                meetingRequest.suggestedDate = suggestedDate;
                meetingRequest.suggestedTime = suggestedTime;
            }

        

return meetingRequest.save().then((updatedRequest) => {
    return syncSubscriptionStatus(
        updatedRequest.subscriptionId
    ).then(() => {
        return res.status(200).json({
            success: true,
            message: "Meeting request updated successfully.",
            meetingRequest: updatedRequest,
        });
    });
});
        })
        .catch((error) => {
            console.log("Admin response error:", error);

            return res.status(500).json({
                success: false,
                message: "Could not update meeting request.",
            });
        });
};
