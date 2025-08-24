// backend/api/stock/stock.routes.js
const express = require('express');
const router = express.Router();
const stockController = require('./stock.controller');
const { authenticate, authorizeAdmin } = require('../middleware/auth.middleware');

// Route to get all stock levels (Admin only)
router.get('/', authenticate, authorizeAdmin, stockController.getAllStock);

// FIX: Change the route to '/add' to match the client-side fetch request
router.post('/add', authenticate, authorizeAdmin, stockController.addStock);

// Route to update stock for a specific product (Admin only)
router.put('/:productId', authenticate, authorizeAdmin, stockController.updateProductStock);

module.exports = router;
