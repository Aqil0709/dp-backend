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

// Public route for UPI payment verification callback
router.post('/payment/verify', verifyUpiPayment);

// Authenticated routes
router.use(authenticate);

// Order creation
router.post('/cod/:userId', createCashOnDeliveryOrder);
router.post('/upi/:userId', createUpiOrder);

// User-specific orders
router.get('/myorders', getMyOrders);
router.get('/:orderId/status', getOrderStatus);
router.post('/:orderId/cancel', cancelOrderController);

// Admin-only route for updating order status (you'll need a separate admin middleware for this)
router.put('/:orderId/status', updateOrderStatus);
router.get('/', getAllOrders);

module.exports = router;
