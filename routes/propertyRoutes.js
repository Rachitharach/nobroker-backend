
const express = require("express");
const authMiddleware = require("../middleware/authMiddlewaree");
const {
    getProperties,
    searchProperties,
} = require("../controllers/propertyController");

const {
    getOwnerDetails,
} = require("../controllers/paymentController");

const router = express.Router();

// Get all properties
router.get("/get", getProperties);

// Search properties using filters

router.post("/search", searchProperties);

//getownerdetails

router.get("/:id/owner-details", authMiddleware, getOwnerDetails);

module.exports = router;
// hht://localhost:5000/api/properties/search