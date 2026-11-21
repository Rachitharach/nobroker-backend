
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddlewaree");
const isAdmin = require("../middleware/isAdmin");

const {
    createMeetingRequest,
    getMyMeetingRequests,
    getAllMeetingRequests,
    respondToMeetingRequest,
} = require("../controllers/meetingController");

// User routes
router.post("/request", authMiddleware, createMeetingRequest);
router.get("/my-requests", authMiddleware, getMyMeetingRequests);

// Admin routes
router.get(
    "/admin/requests",
    authMiddleware,
    isAdmin,
    getAllMeetingRequests
);

router.put(
    "/admin/requests/:id/respond",
    authMiddleware,
    isAdmin,
    respondToMeetingRequest
);

module.exports = router;
