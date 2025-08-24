const admin = require('firebase-admin');
admin.initializeApp(); // Initialize the Firebase Admin SDK once

// Import and export your individual Cloud Functions
exports.auth = require('./auth.functions');
exports.cart = require('./cart.functions');
exports.orders = require('./order.functions');
exports.products = require('./product.functions');
exports.profile = require('./profile.functions');
exports.stock = require('./stock.functions');
// You might also export individual functions directly if preferred:
// exports.getProducts = require('./product.functions').getProducts;