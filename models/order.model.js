// backend/models/order.model.js

const mongoose = require('mongoose');
const { Schema } = mongoose;

// Schema for the items within an order.
// We store a snapshot of details like name and price.
const orderItemSchema = new Schema({
    product: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }, // Price at the time of purchase
    image: { type: String, required: true },
});

// Schema for the shipping address.
// We embed a full copy to preserve the address used for this specific order.
const shippingAddressSchema = new Schema({
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    pincode: { type: String, required: true },
    locality: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    address_type: { type: String, required: true },
});

const orderSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    orderItems: [orderItemSchema],
    shippingAddress: {
        type: shippingAddressSchema,
        required: true,
    },
    totalAmount: {
        type: Number,
        required: true,
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['UPI', 'COD'],
    },

    paymentStatus: {
        type: String,
        required: true,
        default: 'Pending',
    },
    transactionRef: { // For UPI payments
        type: String,
    },
    status: {
        type: String,
        required: true,
        // FIX: Added 'Return Requested' to the list of allowed statuses.
        enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested'],
        default: 'Processing',
    },
    // FIX: Added a field to store the reason for the return.
    returnReason: {
        type: String,
    },
}, {
    timestamps: true, // `createdAt` will serve as the order date
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
