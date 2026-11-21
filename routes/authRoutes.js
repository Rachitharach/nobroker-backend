const express = require("express");
const router = express.Router();

const {
    requestOtp,
    verifyOtp,
    updateProfile,
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddlewaree")

// Request OTP
router.post("/request-otp", requestOtp);

// Verify OTP
router.post("/verify-otp", verifyOtp);

// Save profile - JWT required
router.put("/profile", authMiddleware, updateProfile);

module.exports = router;



// const express = require("express");
// const router = express.Router();

// const {
//     requestOtp,
//     verifyOtp,
//     updateProfile,
//     firebaseLogin,
// } = require("../controllers/authController");

// const authMiddleware = require("../middleware/authMiddlewaree");

// // Firebase login - verify Firebase token and issue app JWT
// router.post("/firebase-login", firebaseLogin);

// // Existing routes (keep for now)
// router.post("/request-otp", requestOtp);
// router.post("/verify-otp", verifyOtp);

// // Save profile - JWT required
// router.put("/profile", authMiddleware, updateProfile);

// module.exports = router;
