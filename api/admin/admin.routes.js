// backend/api/routes/admin.routes.js

const express = require('express');
const router = express.Router();
const { getUserCartForAdmin } = require('../admin/admin.controller');
const { authenticate, authorizeAdmin } = require('../middleware/auth.middleware');

// All routes in this file are protected and for admins only

// GET a specific user's cart content
router.get('/users/:userId/cart', authenticate, authorizeAdmin, getUserCartForAdmin);

module.exports = router;
