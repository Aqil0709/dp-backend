// backend/models/cart.model.js

const mongoose = require('mongoose');
const { Schema } = mongoose;

// This defines the structure for a single item within the cart's item array
const cartItemSchema = new Schema({
    product: {
        type: Schema.Types.ObjectId, // A reference to a Product document's ID
        ref: 'Product', // Tells Mongoose that this ID refers to the 'Product' model
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1, // A cart item must have at least one in quantity
        default: 1,
    },
});

// This is the main schema for the entire cart
const cartSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId, // A reference to a User document's ID
        ref: 'User', // Refers to the 'User' model
        required: true,
        unique: true, // Each user can only have one cart
    },
    items: [cartItemSchema], // The cart is an array of items, using the schema above
}, {
    timestamps: true, // Automatically adds `createdAt` and `updatedAt`
});

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;