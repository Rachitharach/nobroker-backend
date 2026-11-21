
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
    const phone = req.body.phone;
    const otp = req.body.otp;

    if (!phone || !/^[0-9]{10}$/.test(String(phone)) || !otp) {
        return res.status(400).json({
            message: "Enter a valid 10-digit phone number and OTP",
        });
    }

    const savedOtp = otpStore.get(String(phone));

    if (!savedOtp) {
        return res.status(400).json({
            message: "Please request an OTP first",
        });
    }

    // Check expiry
    if (Date.now() >= savedOtp.expiresAt) {
        otpStore.delete(String(phone));

        return res.status(400).json({
            message: "OTP expired. Please request a new OTP",
            otpExpired: true,
        });
    }

    // Allow a maximum of 5 attempts
    savedOtp.attempts += 1;

    if (savedOtp.attempts > 5) {
        otpStore.delete(String(phone));

        return res.status(429).json({
            message: "Too many attempts. Please request a new OTP",
        });
    }

    // Check whether OTP matches
    if (String(otp) !== savedOtp.otp) {
        return res.status(400).json({
            message: "Invalid OTP",
            attemptsRemaining: 5 - savedOtp.attempts,
        });
    }

    // OTP verified; remove it
    otpStore.delete(String(phone));

    // Check whether user already exists
    User.findOne({ phone: String(phone) })
        .then((user) => {
            const token = createToken(String(phone));

            // Existing user: login
            if (user && user.name && user.email) {
                return res.json({
                    message: "Login successful",
                    isNewUser: false,
                    requiresProfile: false,
                    token: token,
                    user: {
                        phone: user.phone,
                        name: user.name,
                        email: user.email,
                    },
                });
            }

            // New user: complete signup
            return res.json({
                message: "OTP verified successfully",
                isNewUser: !user,
                requiresProfile: true,
                token: token,
                user: user
                    ? {
                        phone: user.phone,
                        name: user.name,
                        email: user.email,
                    }
                    : {
                        phone: String(phone),
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
    const name = req.body.name;
    const email = req.body.email;
    const phone = req.user.phone;

    if (!name || !name.trim()) {
        return res.status(400).json({
            message: "Name is required",
        });
    }

    const normalizedEmail = email
        ? email.trim().toLowerCase()
        : "";

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
        return res.status(400).json({
            message: "Please enter a valid email",
        });
    }




// Check if email belongs to another user
User.findOne({
    email: normalizedEmail,
})
    .then((existingUser) => {
        if (existingUser) {
            return res.status(409).json({
                message: "This email is already registered",
            });
        }

        // Check whether this phone number already exists
        return User.findOne({
            phone: phone,
        });
    })
    .then((existingPhone) => {
        if (!existingPhone) {
            return User.create({
                phone: phone,
                name: name.trim(),
                email: normalizedEmail,
            });
        }

        res.status(409).json({
            message: "This phone number is already registered",
        });

        return null;
    })
    .then((user) => {
        if (!user) {
            return;
        }

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
}


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