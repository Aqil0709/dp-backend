const express = require('express');
const router = express.Router();
// Correctly import all required controller functions directly
const {
    createPendingUpiOrder,
    getOrderStatus,
    getAllOrders,
    getMyOrders,
    createCashOnDeliveryOrder,
    cancelOrderController,
    updateOrderStatus 
} = require('../controllers/order.controller');
const { authenticate, authorizeAdmin } = require('../middleware/auth.middleware');

// POST /api/orders/upi-initiate/:userId - Initiate a pending UPI order
router.post('/upi-initiate/:userId', authenticate, createPendingUpiOrder);

// GET /api/orders/:userId/:orderId - Get status of an order
router.get('/:userId/:orderId', authenticate, getOrderStatus);

// GET /api/orders - Get all orders (Admin only)
router.get('/', authenticate, authorizeAdmin, getAllOrders);

// --- CORRECTED ROUTE WITH DIAGNOSTIC LOGGING ---
// PUT /api/orders/:orderId/status - Update an order's status (Admin only)
router.put(
    '/:orderId/status', 
    authenticate, 
    authorizeAdmin, 
    // This new middleware will log a message if the route is successfully matched.
    (req, res, next) => {
        console.log('--- ROUTE HANDLER FOR /:orderId/status REACHED ---');
        next(); // This passes the request to the next function, updateOrderStatus
    },
    updateOrderStatus
);

// POST /api/orders/user/:userId/orders/cod - Create a Cash on Delivery order
router.post('/user/:userId/orders/cod', authenticate, createCashOnDeliveryOrder);

// GET /api/orders/my-orders - Get orders for the authenticated user
router.get('/my-orders', authenticate, getMyOrders);

// PUT /api/orders/:orderId/cancel - Cancel an order (User)
router.put('/:orderId/cancel', authenticate, cancelOrderController);

module.exports = router;
