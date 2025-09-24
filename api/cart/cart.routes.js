const express = require('express');
const router = express.Router();

// 1. IMPORT the 'authenticate' middleware
const { authenticate } = require('../middleware/auth.middleware');

// 2. Import all controller functions
const { 
    getCart, 
    addToCart, 
    updateCartItem, 
    removeCartItem, 
    clearUserCart 
} = require('../cart/cart.controller');

// --- SECURED CART ROUTES ---
// The user's ID will now be taken from their authentication token (req.user._id) 
// instead of the URL, which is much more secure.

// GET /api/cart - Get the authenticated user's cart
router.get('/', authenticate, getCart);

// POST /api/cart/add - Add an item to the cart
router.post('/add', authenticate, addToCart);

// PUT /api/cart/update/:productId - Update an item's quantity
router.put('/update/:productId', authenticate, updateCartItem);

// DELETE /api/cart/remove/:productId - Remove an item from the cart
router.delete('/remove/:productId', authenticate, removeCartItem);

// DELETE /api/cart/clear - Clears all items from the user's cart
router.delete('/clear', authenticate, clearUserCart);

module.exports = router;
