// backend/api/users/user.controller.js

const User = require('../../models/user.model');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
    try {
        // MONGO: Find all users and exclude their password field for security
        const users = await User.find({}).select('-password').sort({ createdAt: -1 });
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching all users:', error);
        res.status(500).json({ message: 'Server error while fetching users.' });
    }
};

// @desc    Update a user's role
// @route   PUT /api/users/:userId/role
// @access  Private/Admin
const updateUserRole = async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role || (role !== 'admin' && role !== 'user')) {
        return res.status(400).json({ message: 'Invalid role specified.' });
    }

    try {
        // MONGO: Find the user by ID and update their role
        const user = await User.findByIdAndUpdate(userId, { role }, { new: true });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(200).json({ message: 'User role updated successfully.' });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ message: 'Server error while updating user role.' });
    }
};

module.exports = {
    getAllUsers,
    updateUserRole,
};