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
    updateOrderStatus,
    returnOrderController,
    downloadInvoiceController // NEW: Import the invoice controller
} = require('../controllers/order.controller');
const { authenticate, authorizeAdmin } = require('../middleware/auth.middleware');

// POST /api/orders/upi-initiate/:userId - Initiate a pending UPI order
router.post('/upi-initiate/:userId', authenticate, createPendingUpiOrder);

// GET /api/orders/my-orders - Get orders for the authenticated user
router.get('/my-orders', authenticate, getMyOrders);

// GET /api/orders/:orderId - Get status of a specific order for the authenticated user
router.get('/:orderId', authenticate, getOrderStatus);

// GET /api/orders - Get all orders (Admin only)
router.get('/', authenticate, authorizeAdmin, getAllOrders);

// --- CORRECTED ROUTE WITH DIAGNOSTIC LOGGING ---
// PUT /api/orders/:orderId/status - Update an order's status (Admin only)
router.put(
    '/:orderId/status', 
    authenticate, 
    authorizeAdmin, 
    (req, res, next) => {
        console.log('--- ROUTE HANDLER FOR /:orderId/status REACHED ---');
        next();
    },
    updateOrderStatus
);

// POST /api/orders/user/:userId/orders/cod - Create a Cash on Delivery order
router.post('/user/:userId/orders/cod', authenticate, createCashOnDeliveryOrder);

// PUT /api/orders/:orderId/cancel - Cancel an order (User)
router.put('/:orderId/cancel', authenticate, cancelOrderController);

// PUT /api/orders/:orderId/return - Request to return an order (User)
router.put('/:orderId/return', authenticate, returnOrderController);

// NEW: Add the route for downloading an invoice
// GET /api/orders/:orderId/invoice - Download a PDF invoice for an order
router.get('/:orderId/invoice', authenticate, downloadInvoiceController);


module.exports = router;
