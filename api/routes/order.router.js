const express = require('express');
const router = express.Router();
const {
    getAllOrders,
    createUpiOrder,
    createCashOnDeliveryOrder,
    getOrderStatus,
    getMyOrders,
    cancelOrderController,
    updateOrderStatus,
    verifyUpiPayment,
} = require('../controllers/order.controller');
const { authenticate, authorizeAdmin } = require('../middleware/auth.middleware');

// This is a public route that Razorpay will call for its webhook. It does not need authentication.
router.post('/payment/verify', verifyUpiPayment);

// All subsequent routes in this file will require a valid user token.
router.use(authenticate);

// --- User-Specific Routes ---
// These routes operate on behalf of the logged-in user.

// Create a new order. The user ID is taken from the auth token, not the URL.
router.post('/cod', createCashOnDeliveryOrder);
router.post('/upi', createUpiOrder);

// Get all orders for the logged-in user.
router.get('/my-orders', getMyOrders);

// Get a single order by its ID.
router.get('/:orderId', getOrderStatus);

// Cancel an order.
router.post('/:orderId/cancel', cancelOrderController);


// --- Admin-Only Routes ---
// These routes are protected and can only be accessed by admin users.

// Get a list of all orders from all users.
router.get('/', authorizeAdmin, getAllOrders);

// Update the status of any order by its ID.
router.put('/:orderId/status', authorizeAdmin, updateOrderStatus);


module.exports = router;
