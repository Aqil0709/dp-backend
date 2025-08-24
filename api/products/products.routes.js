// backend/api/products/products.routes.js
const express = require('express');
const router = express.Router();

// Corrected paths to middleware and controllers
const upload = require('../middleware/upload.middleware'); 
const { authenticate, authorizeAdmin } = require('../middleware/auth.middleware');
const productController = require('./products.controller');

// --- Public Routes ---
// Get all products
router.get('/', productController.getAllProducts);

// Get product by ID
router.get('/:productId', productController.getProductById);

// --- Admin Only Routes (require authentication and admin role) ---

// Add a new product
// The 'upload' middleware now saves the file locally before calling addProduct.
// Removed the redundant :userId parameter for better security.
router.post('/add', authenticate, authorizeAdmin, upload, productController.addProduct);

// Update an existing product
// This route also accepts an optional image upload.
// Removed the redundant :userId parameter.
router.put('/update/:productId', authenticate, authorizeAdmin, upload, productController.updateProduct);

// Delete a product
// Removed the redundant :userId parameter.
router.delete('/delete/:productId', authenticate, authorizeAdmin, productController.deleteProduct);

module.exports = router;
