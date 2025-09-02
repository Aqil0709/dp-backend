const express = require('express');
const router = express.Router();
const {
    getAllProducts,
    getProductById,
    addProduct,
    updateProduct,
    deleteProduct,
    updateProductStock,
    createProductReview,
    getProductReviews,
    updateProductStatus
} = require('./products.controller');
const { authenticate, authorizeAdmin } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// Public Routes
router.get('/', getAllProducts);
router.get('/:productId', getProductById);
router.get('/:productId/reviews', getProductReviews);

// Admin Routes
router.post('/add', authenticate, authorizeAdmin, upload.array('images', 15), addProduct);
router.put('/update/:productId', authenticate, authorizeAdmin, upload.array('images', 15), updateProduct);
router.delete('/delete/:productId', authenticate, authorizeAdmin, deleteProduct);
router.put('/stock/update/:productId', authenticate, authorizeAdmin, updateProductStock);
router.put('/status/:productId', authenticate, authorizeAdmin, updateProductStatus);

// Authenticated User Routes
router.post('/review', authenticate, createProductReview);

module.exports = router;
