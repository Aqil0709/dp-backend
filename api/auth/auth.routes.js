const express = require('express');
const router = express.Router();
// Import all necessary functions from the controller
const {
    registerUser,
    loginUser,
    logoutUser, 
    sendOtp,
    verifyOtp,
    sendResetOtp,
    resetPassword
} = require('./auth.controller');

// --- User Registration and Login ---
// Route for user registration: POST /api/auth/register
router.post('/register', registerUser);

// Route for user login: POST /api/auth/login
router.post('/login', loginUser);

// Route for user logout: POST /api/auth/logout
router.post('/logout', logoutUser);

// --- OTP Verification Flow (for Registration) ---
// Route for sending OTP for new user registration
router.post('/send-otp', sendOtp);

// Route for verifying an OTP (used by both registration and password reset)
router.post('/verify-otp', verifyOtp);

// --- Forgot Password Flow ---
// Route for sending OTP to a registered user for password reset
router.post('/send-reset-otp', sendResetOtp);

// Route for resetting the password after OTP verification
router.post('/reset-password', resetPassword);

module.exports = router;
