const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const propertyRoutes = require("./routes/propertyRoutes");
const postPropertyRoutes = require("./routes/postPropertyRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const meetingRoutes = require("./routes/meetingRoutes")
const { stripeWebhook } = require("./controllers/paymentController");


const app = express();

app.use(cors({
    origin: "http://localhost:5173",
}));

// Stripe webhook - register BEFORE express.json()
app.post(
    "/api/payment/stripe-webhook",
    express.raw({ type: "application/json" }),
    stripeWebhook
);

// Normal JSON middleware
app.use(express.json());

// Test route
app.get("/", (req, res) => {
    res.send("NoBroker Auth Backend is running");
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Property routes
app.use("/api/properties", propertyRoutes);

// Post property routes
app.use("/api/post-properties", postPropertyRoutes);

// Payment routes
app.use("/api/payment", paymentRoutes);

// Admin routes
app.use("/api/admin", adminRoutes);

// Meeting routes
app.use("/api/meetings", meetingRoutes);

// app.post(
//     "/api/payment/stripe-webhook",
//     express.raw({ type: "application/json" }),
//     stripeWebhook
// );

// // Middleware
// app.use(express.json());

// Connect to MongoDB and start server
mongoose
    .connect(process.env.MONGO_URL)
    .then(() => {
        console.log("MongoDB Atlas connected successfully");

console.log("CONNECTED HOST:", mongoose.connection.host);
console.log("CONNECTED DATABASE:", mongoose.connection.name);
console.log(
  "CONNECTED COLLECTION:",
  mongoose.connection.collection("properties").collectionName
);


        app.listen(process.env.PORT || 5000, () => {
            console.log(
                `Server running on http://localhost:${process.env.PORT || 5000}`
            );
        });
    })
    .catch((error) => {
        console.error("MongoDB connection failed:", error.message);
    });