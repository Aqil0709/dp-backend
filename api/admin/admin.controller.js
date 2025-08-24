// backend/api/controllers/admin.controller.js

// We now import the Mongoose-based cart logic
const { fetchUserCartDetails } = require('../cart/cart.controller');

/**
 * @desc    Get a specific user's cart details
 * @route   GET /api/admin/users/:userId/cart
 * @access  Private/Admin
 */
const getUserCartForAdmin = async (req, res) => {
    const { userId } = req.params;
    try {
        // This function now uses Mongoose under the hood!
        const cart = await fetchUserCartDetails(userId);
        res.status(200).json(cart.items || []); // Return items or an empty array
    } catch (error) {
        console.error(`Admin Error: Failed to fetch cart for user ${userId}:`, error);
        res.status(500).json({ message: 'Server error while fetching user cart.' });
    }
};

module.exports = {
    getUserCartForAdmin,
};