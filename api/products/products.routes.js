const express = require('express');
const router = express.Router();

// Corrected paths to middleware and controllers
// Assuming middleware is in a sibling directory to 'api'
const upload = require('../middleware/upload.middleware');
const { authenticate, authorizeAdmin } = require('../middleware/auth.middleware');
// Assuming the controller is in the same directory
const productController = require('./products.controller');

// --- Public Routes ---
// Get all products
router.get('/', productController.getAllProducts);

// Get product by ID
router.get('/:productId', productController.getProductById);


// --- Authenticated User Routes ---
// Add/Create a new review for a product
router.post('/review', authenticate, productController.createProductReview);
router.get('/:productId/reviews', productController.getProductReviews);

// --- Admin Only Routes (require authentication and admin role) ---

// Add a new product
// The 'upload' middleware now saves the file locally before calling addProduct.
router.post('/add', authenticate, authorizeAdmin, upload.array('images', 5), productController.addProduct);

// Update an existing product
// This route also accepts an optional image upload.
router.put('/update/:productId', authenticate, authorizeAdmin, upload.array('images', 5), productController.updateProduct);

// Update a product's status fields (e.g., isSpecial, isTrending)
// This is a new, dedicated route for simple updates without file uploads.
router.put('/status/:productId', authenticate, authorizeAdmin, productController.updateProductStatus);

// Delete a product
router.delete('/delete/:productId', authenticate, authorizeAdmin, productController.deleteProduct);

module.exports = router;
