const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddlewaree");
const isAdmin = require("../middleware/isAdmin");

const { adminLogin } = require("../controllers/adminController");

router.post("/login", adminLogin);

// Both authentication and admin role are checked
router.get("/dashboard", authMiddleware, isAdmin, (req, res) => {
    res.status(200).json({
        success: true,
        message: "Welcome to Admin Dashboard",
        admin: req.user
    });
});

module.exports = router;