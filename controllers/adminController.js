
const jwt = require("jsonwebtoken");

exports.adminLogin = (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Please enter email and password."
        });
    }

    if (
        email !== process.env.ADMIN_EMAIL ||
        password !== process.env.ADMIN_PASSWORD
    ) {
        return res.status(401).json({
            success: false,
            message: "Invalid admin email or password."
        });
    }

    const token = jwt.sign(
        {
            email: email,
            role: "admin"
        },
        process.env.JWT_SECRET,
            {
        noTimestamp: true
    }
    );

    return res.status(200).json({
        success: true,
        message: "Admin login successful.",
        token: token,
        admin: {
            email: email,
            role: "admin"
        }
    });
};
