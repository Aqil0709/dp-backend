const express = require("express");
const router = express.Router();
const { createOrder, verifyPayment } = require("../controllers/payment.controller");
// --- IMPORT from your new middleware file ---
const { authenticate } = require("../middleware/auth.middleware"); 

// Apply the 'authenticate' middleware to protect the routes.
// It will now check for a "Bearer" token in the Authorization header.
router.post("/create-order", authenticate, createOrder);
router.post("/verify", authenticate, verifyPayment);

module.exports = router;
