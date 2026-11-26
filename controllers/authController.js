
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Store OTP temporarily
const otpStore = new Map();

// Generate JWT token
function createToken(phone) {
    return jwt.sign(
        { phone: phone },
        process.env.JWT_SECRET,
        { expiresIn: "60d" }
    );
}

// 1. Request or resend OTP
exports.requestOtp = (req, res) => {
    const phone = req.body.phone;

    // Phone must contain exactly 10 digits
    if (!phone || !/^[0-9]{10}$/.test(String(phone))) {
        return res.status(400).json({
            message: "Please enter a valid 10-digit phone number",
        });
    }

    // Generate six-digit OTP
        const otp = String(
            Math.floor(100000 + Math.random() * 900000)
        );

    // Save OTP for 5 minutes
    otpStore.set(String(phone), {
        otp: otp,
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0,
    });

    // Development only
    return res.json({
        message: "OTP sent successfully",
        devOtp: otp,
        expiresIn: 300,
    });
};

// 2. Verify OTP (login or signup)

exports.verifyOtp = (req, res) => {
    const phone = String(req.body.phone || "").trim();
    const otp = String(req.body.otp || "").trim();

    if (!/^[0-9]{10}$/.test(phone) || !otp) {
        return res.status(400).json({
            message: "Enter a valid 10-digit phone number and OTP",
        });
    }

    const savedOtp = otpStore.get(phone);

    if (!savedOtp) {
        return res.status(400).json({
            message: "Please request an OTP first",
        });
    }

    if (Date.now() >= savedOtp.expiresAt) {
        otpStore.delete(phone);

        return res.status(400).json({
            message: "OTP expired. Please request a new OTP",
            otpExpired: true,
        });
    }

    savedOtp.attempts += 1;

    if (savedOtp.attempts > 5) {
        otpStore.delete(phone);

        return res.status(429).json({
            message: "Too many attempts. Please request a new OTP",
        });
    }

    if (otp !== savedOtp.otp) {
        return res.status(400).json({
            message: "Invalid OTP",
            attemptsRemaining: 5 - savedOtp.attempts,
        });
    }

    otpStore.delete(phone);

    console.log("Searching phone:", phone);
    console.log("Database:", User.db.name);
    console.log("Collection:", User.collection.name);

    User.findOne({ phone: phone })
        .then((user) => {
            console.log("FOUND USER:", user);

            const token = createToken(phone);

            // Existing user with completed profile
            if (user && user.name && user.email) {
                return res.json({
                    message: "Login successful",
                    isNewUser: false,
                    requiresProfile: false,
                    token,
                    user: {
                        phone: user.phone,
                        name: user.name,
                        email: user.email,
                    },
                });
            }

            // New user or existing user with incomplete profile
            return res.json({
                message: "OTP verified successfully",
                isNewUser: !user,
                requiresProfile: true,
                token,
                user: user
                    ? {
                        phone: user.phone,
                        name: user.name,
                        email: user.email,
                    }
                    : {
                        phone,
                        name: "",
                        email: "",
                    },
            });
        })
        .catch((error) => {
            console.log("Login error:", error);

            return res.status(500).json({
                message: "Could not verify OTP",
            });
        });
};


// 3. Save user profile (signup)

exports.updateProfile = (req, res) => {
    const phone = String(req.user.phone);
    const name = String(req.body.name || "").trim();
    const normalizedEmail = String(req.body.email || "")
        .trim()
        .toLowerCase();

    if (!name) {
        return res.status(400).json({
            message: "Name is required",
        });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
        return res.status(400).json({
            message: "Please enter a valid email",
        });
    }

    User.findOne({ phone })
        .then((user) => {
            if (user && user.name && user.email) {
                return res.status(409).json({
                    message: "Profile is already completed",
                });
            }

            return User.findOne({
                email: normalizedEmail,
                phone: { $ne: phone },
            }).then((existingEmail) => {
                if (existingEmail) {
                    return res.status(409).json({
                        message: "This email is already registered",
                    });
                }

                if (user) {
                    user.name = name;
                    user.email = normalizedEmail;

                    return user.save();
                }

                return User.create({
                    phone,
                    name,
                    email: normalizedEmail,
                });
            });
        })
        .then((user) => {
            if (!user || res.headersSent) return;

            return res.json({
                message: "Profile saved successfully",
                user: {
                    phone: user.phone,
                    name: user.name,
                    email: user.email,
                },
            });
        })
        .catch((error) => {
            console.log("Profile error:", error);

            if (error.code === 11000) {
                return res.status(409).json({
                    message: "Phone number or email is already registered",
                });
            }

            return res.status(500).json({
                message: "Could not save profile",
            });
        });
};



// Firebase login
exports.firebaseLogin = (req, res) => {
  const { phone } = req.body;

  if (!phone || !/^[0-9]{10}$/.test(String(phone))) {
    return res.status(400).json({
      message: "Please enter a valid 10-digit phone number",
    });
  }

  User.findOne({ phone: String(phone) })
    .then((user) => {
      const token = createToken(String(phone));

      if (user && user.name && user.email) {
        return res.json({
          message: "Login successful",
          requiresProfile: false,
          token,
          user: {
            phone: user.phone,
            name: user.name,
            email: user.email,
          },
        });
      }

      return res.json({
        message: "Phone accepted",
        requiresProfile: true,
        token,
        user: user
          ? { phone: user.phone, name: user.name, email: user.email }
          : { phone: String(phone), name: "", email: "" },
      });
    })
    .catch((error) => {
      console.log("Firebase login error:", error);
      return res.status(500).json({
        message: "Login failed",
      });
    });
};