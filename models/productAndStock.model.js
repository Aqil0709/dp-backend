// backend/models/productAndStock.model.js

const mongoose = require('mongoose');
const { Schema } = mongoose;

// --- Product Schema ---
// This schema defines the structure for products in your store.
const productSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    category: {
        type: String,
        trim: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    available: {
        type: Boolean,
        default: true
    },
quantity: {
    type: Number,
    required: true,
    min: 0
}
}, {
    timestamps: true
});

// --- Stock Schema ---
// This schema defines the stock levels for each product.
const stockSchema = new Schema({
    // The 'product' field is a reference to the 'Product' model.
    // This creates a relationship between the two collections.
    product: {
        type: Schema.Types.ObjectId,
        ref: 'Product', // 'ref' must be the name of the model
        required: true,
        unique: true // Ensures only one stock entry per product
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    product_name: {
        type: String,
        required: true,
        trim: true
    }
}, {
    timestamps: true
});

// FIX: Check if models already exist to prevent OverwriteModelError
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
const Stock = mongoose.models.Stock || mongoose.model('Stock', stockSchema);

module.exports = { Product, Stock };
