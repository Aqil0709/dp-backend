// backend/api/profile/profile.routes.js
const express = require('express');
const router = express.Router();
const { 
    updateUserProfile, 
    getUserAddresses, 
    addUserAddress 
} = require('./profile.controller');
const { authenticate } = require('../middleware/auth.middleware'); // Import authentication middleware

// --- DEBUGGING LOGS FOR IMPORTS (Keep for now to ensure all is loaded) ---
console.log('--- Debugging profile.routes.js Imports ---');
console.log('profileController:', updateUserProfile ? 'Loaded' : 'FAILED'); // Check individual functions
console.log('getUserAddresses:', getUserAddresses ? 'Loaded' : 'FAILED');
console.log('addUserAddress:', addUserAddress ? 'Loaded' : 'FAILED');
console.log('authenticate:', authenticate ? 'Loaded' : 'FAILED');
console.log('-------------------------------------------');

// PUT /api/profile/:userId - Update user's personal details (e.g., name)
// IMPORTANT: Added 'authenticate' middleware here
router.put('/:userId', authenticate, updateUserProfile);

// GET /api/profile/:userId/addresses - Get all addresses for a user
// IMPORTANT: Add 'authenticate' middleware here as well for security
router.get('/:userId/addresses', authenticate, getUserAddresses);

// POST /api/profile/:userId/addresses - Add a new address for a user
// IMPORTANT: Add 'authenticate' middleware here as well for security
router.post('/:userId/addresses', authenticate, addUserAddress);

module.exports = router;
