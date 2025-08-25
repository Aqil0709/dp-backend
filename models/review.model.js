// models/reviewModel.js

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User', // Reference to your User model
        required: true,
    },
    product: {
        type: mongoose.Schema.ObjectId,
        ref: 'Product', // Reference to your Product model
        required: true,
    },
    rating: {
        type: Number,
        required: [true, 'Please provide a rating'],
        min: 1,
        max: 5,
    },
    comment: {
        type: String,
        trim: true,
    },
}, { timestamps: true }); // Automatically adds createdAt and updatedAt

module.exports = mongoose.model('Review', reviewSchema);