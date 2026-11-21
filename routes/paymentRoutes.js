const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddlewaree");

const {
    createOrder,
    verifyPayment,
    getMySubscription,
    getOwnerDetails,
    getMyCommercialTenantPlan,
    createCommercialTenantCheckout,
} = require("../controllers/paymentController");
// Create payment order
router.post("/create-order", authMiddleware, createOrder);

// Verify payment
router.post("/verify", authMiddleware, verifyPayment);

// Get logged-in user's subscription
router.get("/my-plan", authMiddleware, getMySubscription);

router.get("/:id/owner-details", authMiddleware, getOwnerDetails);
router.get(
    "/commercial-tenant/my-plan",
    authMiddleware,
    getMyCommercialTenantPlan
);

router.post(
    "/commercial-tenant/create-checkout-session",
    authMiddleware,
    createCommercialTenantCheckout
);
module.exports = router;