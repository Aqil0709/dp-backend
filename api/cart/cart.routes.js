const express = require('express');
const router = express.Router();

// Ensure the imported functions match the new Mongoose controller's exports
const { getCart, addToCart, updateCartItem, removeCartItem, clearUserCart  } = require('./cart.controller');

// GET /api/cart/:userId - Get a user's cart
router.get('/:userId', getCart);

// POST /api/cart/:userId/add - Add an item to the cart
router.post('/:userId/add', addToCart);

// PUT /api/cart/:userId/update/:productId - Update an item's quantity
router.put('/:userId/update/:productId', updateCartItem);

// DELETE /api/cart/:userId/remove/:productId - Remove an item from the cart
router.delete('/:userId/remove/:productId', removeCartItem);



module.exports = router;
