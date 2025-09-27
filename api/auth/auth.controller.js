const User = require('../../models/user.model'); // <-- IMPORT the new User model
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const TWOFACTOR_API_KEY = process.env.TWOFACTOR_API_KEY;

// --- Helper function to check for API Key presence ---
const checkTwoFactorApiKey = () => {
    if (!TWOFACTOR_API_KEY) {
        console.error('TWOFACTOR_API_KEY is not defined in environment variables!');
        return false;
    }
    return true;
};

// --- Send OTP for Registration ---
const sendOtp = async (req, res) => {
    const { mobileNumber } = req.body;

    if (!checkTwoFactorApiKey()) {
        return res.status(500).json({ success: false, message: 'Server configuration error.' });
    }
    if (!mobileNumber) {
        return res.status(400).json({ success: false, message: 'Mobile number is required.' });
    }

    try {
        // MONGO: Check if user already exists using the User model
        const existingUser = await User.findOne({ mobileNumber });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'User with this mobile number already exists.' });
        }

        const twoFactorUrl = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/${mobileNumber}/AUTOGEN`;
        const twoFactorResponse = await fetch(twoFactorUrl);
        const twoFactorData = await twoFactorResponse.json();

        if (twoFactorData.Status === 'Success') {
            res.json({ success: true, sessionId: twoFactorData.Details, message: 'OTP sent successfully!' });
        } else {
            res.status(500).json({ success: false, message: twoFactorData.Details || 'Failed to send OTP.' });
        }
    } catch (error) {
        console.error('Error in sendOtp:', error);
        res.status(500).json({ success: false, message: 'Server error while sending OTP.' });
    }
};

// --- Verify OTP (No database interaction, so no changes needed) ---
const verifyOtp = async (req, res) => {
    const { otp, sessionId } = req.body;

    if (!checkTwoFactorApiKey()) {
        return res.status(500).json({ success: false, message: 'Server configuration error.' });
    }
    if (!otp || !sessionId) {
        return res.status(400).json({ success: false, message: 'OTP and Session ID are required.' });
    }

    try {
        const twoFactorUrl = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/VERIFY/${sessionId}/${otp}`;
        const twoFactorResponse = await fetch(twoFactorUrl);
        const twoFactorData = await twoFactorResponse.json();

        if (twoFactorData.Status === 'Success') {
            res.json({ success: true, message: 'OTP verified successfully!' });
        } else {
            res.status(400).json({ success: false, message: twoFactorData.Details || 'Invalid OTP.' });
        }
    } catch (error) {
        console.error('Error in verifyOtp:', error);
        res.status(500).json({ success: false, message: 'Server error while verifying OTP.' });
    }
};

// --- Send OTP for Password Reset ---
const sendResetOtp = async (req, res) => {
    const { mobileNumber } = req.body;

    if (!checkTwoFactorApiKey()) {
        return res.status(500).json({ success: false, message: 'Server configuration error.' });
    }
    if (!mobileNumber) {
        return res.status(400).json({ success: false, message: 'Mobile number is required.' });
    }

    try {
        // MONGO: Check if the user *exists* before sending a reset OTP.
        const existingUser = await User.findOne({ mobileNumber });
        if (!existingUser) {
            return res.status(404).json({ success: false, message: 'User with this mobile number not found.' });
        }

        const twoFactorUrl = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/${mobileNumber}/AUTOGEN`;
        const twoFactorResponse = await fetch(twoFactorUrl);
        const twoFactorData = await twoFactorResponse.json();

        if (twoFactorData.Status === 'Success') {
            res.json({ success: true, sessionId: twoFactorData.Details, message: 'Password reset OTP sent successfully!' });
        } else {
            res.status(500).json({ success: false, message: twoFactorData.Details || 'Failed to send OTP.' });
        }
    } catch (error) {
        console.error('Error in sendResetOtp:', error);
        res.status(500).json({ success: false, message: 'Server error while sending reset OTP.' });
    }
};

// --- Reset Password ---
const resetPassword = async (req, res) => {
    const { mobileNumber, newPassword } = req.body;

    if (!mobileNumber || !newPassword) {
        return res.status(400).json({ success: false, message: 'Mobile number and new password are required.' });
    }

    try {
        // MONGO: Find the user first
        const user = await User.findOne({ mobileNumber });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // MONGO: Update the user's password and save the document
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ success: true, message: 'Password has been reset successfully.' });

    } catch (error) {
        console.error('Error in resetPassword:', error);
        res.status(500).json({ success: false, message: 'Server error during password reset.' });
    }
};

// --- Register User ---
const registerUser = async (req, res) => {
    const { mobileNumber, password, fullName } = req.body;

    if (!mobileNumber || !password || !fullName) {
        return res.status(400).json({ message: 'Mobile number, password, and full name are required.' });
    }

    try {
        // MONGO: Check if user already exists
        const userExists = await User.findOne({ mobileNumber });
        if (userExists) {
            return res.status(409).json({ message: 'User with this mobile number already exists.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // MONGO: Create and save the new user
        const user = await User.create({
            name: fullName,
            mobileNumber,
            password: hashedPassword,
        });

        // MONGO: Mongoose returns the created user document, so we can use its properties
        const token = jwt.sign(
            { userId: user._id, role: user.role }, // Use user._id from MongoDB
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.status(201).json({
            _id: user._id,
            name: user.name,
            mobileNumber: user.mobileNumber,
            role: user.role,
            token: token,
            message: 'Registration successful.'
        });

    } catch (error)
        {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
};

// --- Login User ---
const loginUser = async (req, res) => {
    const { mobileNumber, password } = req.body;

    if (!mobileNumber || !password) {
        return res.status(400).json({ message: 'Mobile number and password are required.' });
    }

    try {
        // MONGO: Find the user by mobile number
        const user = await User.findOne({ mobileNumber });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const token = jwt.sign(
            { userId: user._id, role: user.role }, // Use user._id from MongoDB
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({
            _id: user._id,
            name: user.name,
            mobileNumber: user.mobileNumber,
            role: user.role,
            token: token,
            message: 'Login successful.'
        });

    } catch (error)
        {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
};

// --- Logout User (No database interaction, no changes needed) ---
const logoutUser = (req, res) => {
    res.status(200).json({ message: 'Logout successful.' });
};

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    sendOtp,
    verifyOtp,
    sendResetOtp,
    resetPassword
};
