const express = require('express');
const router = express.Router();
// Corrected: Import getAllOrders as well
const { createPendingUpiOrder, getOrderStatus, getAllOrders } = require('../controllers/order.controller');
// Assume you have an authentication middleware to get current user ID from token
const { authenticate, authorizeAdmin } = require('../middleware/auth.middleware'); // You need to implement this

// POST /api/orders/upi-initiate/:userId - Initiate a pending UPI order
router.post('/upi-initiate/:userId', authenticate, createPendingUpiOrder);

// GET /api/orders/:userId/:orderId - Get status of an order (for polling or manual check)
router.get('/:userId/:orderId', authenticate, getOrderStatus);

// NEW: GET /api/orders - Get all orders (Admin only)
// This route is protected by authentication and requires admin role
router.get('/', authenticate, authorizeAdmin, getAllOrders);


module.exports = router;
