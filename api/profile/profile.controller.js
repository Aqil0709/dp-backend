// backend/api/profile/profile.controller.js

const User = require('../../models/user.model');

// --- User Profile ---
const updateUserProfile = async (req, res) => {
    const { userId } = req.params;
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ message: 'Name is required for profile update.' });
    }

    try {
        // FIX: Changed req.userData.userId to req.user._id to match the current auth middleware
        if (!req.user || req.user._id.toString() !== userId) {
            return res.status(403).json({ message: 'Forbidden: You can only update your own profile.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.name = name;
        const updatedUser = await user.save();

        res.status(200).json({
            message: 'Profile updated successfully!',
            user: { // Send back non-sensitive info
                _id: updatedUser._id,
                name: updatedUser.name,
                mobileNumber: updatedUser.mobileNumber,
                role: updatedUser.role,
            }
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Server error while updating profile.' });
    }
};

// --- User Addresses ---
const getUserAddresses = async (req, res) => {
    const { userId } = req.params;

    try {
        // FIX: Changed req.userData.userId to req.user._id
        if (!req.user || req.user._id.toString() !== userId) {
            return res.status(403).json({ message: 'Forbidden: You can only view your own addresses.' });
        }

        const user = await User.findById(userId).select('addresses');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(200).json(user.addresses);
    } catch (error) {
        console.error('Get addresses error:', error);
        res.status(500).json({ message: 'Server error while fetching addresses.' });
    }
};

const addUserAddress = async (req, res) => {
    const { userId } = req.params;
    const { name, mobile, pincode, locality, address, city, state, address_type } = req.body;

    try {
        // FIX: Changed req.userData.userId to req.user._id
        if (!req.user || req.user._id.toString() !== userId) {
            return res.status(403).json({ message: 'Forbidden: You can only add an address to your own profile.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const newAddress = { name, mobile, pincode, locality, address, city, state, address_type };
        user.addresses.push(newAddress);
        await user.save();

        res.status(201).json({
            message: 'Address added successfully!',
            address: user.addresses[user.addresses.length - 1]
        });
    } catch (error) {
        console.error('Add address error:', error);
        res.status(500).json({ message: 'Server error while adding address.' });
    }
};

module.exports = {
    updateUserProfile,
    getUserAddresses,
    addUserAddress
};
