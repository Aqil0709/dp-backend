// backend/api/profile/profile.controller.js

const User = require('../models/user.model');

// --- User Profile ---
const updateUserProfile = async (req, res) => {
    const { userId } = req.params;
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ message: 'Name is required for profile update.' });
    }

    try {
        // Security check to ensure users can only update their own profile
        if (!req.userData || req.userData.userId !== userId) {
            return res.status(403).json({ message: 'Forbidden: You can only update your own profile.' });
        }

        // MONGO: Find the user, update the name, and save.
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
        // Security check
        if (!req.userData || req.userData.userId !== userId) {
            return res.status(403).json({ message: 'Forbidden: You can only view your own addresses.' });
        }

        // MONGO: Find the user and return their embedded addresses array.
        const user = await User.findById(userId).select('addresses'); // .select('addresses') is an optimization
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
        // Security check
        if (!req.userData || req.userData.userId !== userId) {
            return res.status(403).json({ message: 'Forbidden: You can only add an address to your own profile.' });
        }

        // MONGO: Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // MONGO: Add the new address to the embedded array and save the parent user document.
        const newAddress = { name, mobile, pincode, locality, address, city, state, address_type };
        user.addresses.push(newAddress);
        await user.save();

        res.status(201).json({
            message: 'Address added successfully!',
            // Mongoose adds an _id to the subdocument automatically, which is useful for the frontend.
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