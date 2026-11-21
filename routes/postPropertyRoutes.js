const express = require("express");
const router = express.Router();

const {
  createPostProperty,
  getMyListings,
} = require("../controllers/postPropertyController");

const authMiddleware = require("../middleware/authMiddlewaree");
const upload = require("../middleware/uploadMiddleware");

// My Listings endpoint
router.get("/my-listings", authMiddleware, getMyListings);

// Submit a property with up to 10 images
router.post(
  "/",
  authMiddleware,
  upload.array("images", 10),
  createPostProperty
);

module.exports = router;