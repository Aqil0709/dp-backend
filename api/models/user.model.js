// backend/models/user.model.js

const mongoose = require('mongoose');

// This is a schema for the addresses that will be embedded in the user document
const addressSchema = new mongoose.Schema({
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    pincode: { type: String, required: true },
    locality: { type: String, required: true },
    address: { type: String, required: true }, // The main address line
    city: { type: String, required: true },
    state: { type: String, required: true },
    address_type: { type: String, enum: ['Home', 'Work'], required: true },
});

// This is the main user schema
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    mobileNumber: {
        type: String,
        required: true,
        unique: true, // Ensures no two users can have the same mobile number
        match: [/^[0-9]{10}$/, 'Please fill a valid mobile number'], // Optional: validates 10-digit number
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['user', 'admin'], // The role can only be one of these two values
        default: 'user', // New users are 'user' by default
    },
    addresses: [addressSchema], // An array of addresses, using the schema defined above
}, {
    timestamps: true, // Automatically adds `createdAt` and `updatedAt` fields
});

// The model is the interface you'll use to interact with the 'users' collection in your DB
const User = mongoose.model('User', userSchema);

module.exports = User;