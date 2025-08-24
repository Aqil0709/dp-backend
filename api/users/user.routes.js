// backend/api/users/user.routes.js

const express = require('express');
const router = express.Router();
const { getAllUsers, updateUserRole } = require('../users/user.controller');
const { authenticate, authorizeAdmin } = require('../middleware/auth.middleware');

// GET /api/users - Get all users (Admin only)
router.get('/', authenticate, authorizeAdmin, getAllUsers);

// PUT /api/users/:userId/role - Update a user's role (Admin only)
router.put('/:userId/role', authenticate, authorizeAdmin, updateUserRole);

module.exports = router;
