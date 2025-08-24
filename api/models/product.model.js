// backend/models/product.model.js

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true, // Removes whitespace from both ends
    },
    category: {
        type: String,
        required: [true, 'Product category is required'],
        trim: true,
    },
    price: {
        type: Number,
        required: [true, 'Product price is required'],
        min: [0, 'Price cannot be negative'],
    },
    originalPrice: {
        type: Number,
        required: [true, 'Original price is required'],
        min: [0, 'Original price cannot be negative'],
    },
    description: {
        type: String,
        required: [true, 'Product description is required'],
    },
    images: {
        type: [String], // An array of image URLs
        required: true,
        validate: [
            (arr) => arr.length > 0,
            'At least one product image is required.',
        ],
    },
    quantity: {
        type: Number,
        required: [true, 'Stock quantity is required'],
        min: [0, 'Quantity cannot be negative'],
        default: 0,
    },
}, {
    timestamps: true, // Automatically adds `createdAt` and `updatedAt` fields
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;