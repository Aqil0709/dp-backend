// backend/api/orders/order.controller.js

const mongoose = require('mongoose');
const Order = require('../models/order.model');
const User = require('../models/user.model');
const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const { fetchUserCartDetails } = require('../cart/cart.controller');

const getAllOrders = async (req, res) => {
    try {
        // MONGO: Find all orders, populate user's name, and sort by newest
        const orders = await Order.find({})
            .populate('user', 'name mobileNumber') // Populate user with only name and mobile
            .sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching all orders:', error);
        res.status(500).json({ message: 'Server error while fetching orders.' });
    }
};

const getMyOrders = async (req, res) => {
    try {
        // MONGO: Find orders that belong to the logged-in user
        const orders = await Order.find({ user: req.userData.userId }).sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        console.error("Error in getMyOrders:", error);
        res.status(500).json({ message: "Server error while fetching user's orders." });
    }
};

const getOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    try {
        // MONGO: Find a single order by its ID, ensuring it belongs to the user
        const order = await Order.findOne({ _id: orderId, user: req.userData.userId });
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        res.status(200).json(order);
    } catch (error) {
        console.error('Error fetching order status:', error);
        res.status(500).json({ message: 'Server error while fetching order status.' });
    }
};

const updateOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ message: 'New status is required.' });
    }

    try {
        // MONGO: Find the order by ID and update its status
        const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true });
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        res.status(200).json({ message: 'Order status updated successfully.', order });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Server error while updating order status.' });
    }
};

// --- TRANSACTIONAL ORDER CREATION ---
const createCashOnDeliveryOrder = async (req, res) => {
    const { userId } = req.params;
    const { deliveryAddressId } = req.body;

    // A session is MongoDB's equivalent of a transaction
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        // 1. Get user, their chosen address, and their cart (within the transaction)
        const user = await User.findById(userId).session(session);
        const cart = await fetchUserCartDetails(userId); // Fetches populated cart

        if (!cart || cart.items.length === 0) {
            throw new Error('Cannot place an order with an empty cart.');
        }

        const address = user.addresses.id(deliveryAddressId);
        if (!address) {
            throw new Error('Delivery address not found.');
        }
        
        const orderItems = [];
        let totalAmount = 0;

        // 2. Process each item in the cart
        for (const item of cart.items) {
            const product = await Product.findById(item.product._id).session(session);

            if (!product || product.quantity < item.quantity) {
                throw new Error(`Insufficient stock for product "${item.product.name}".`);
            }

            // Decrease stock and save the product (within the transaction)
            product.quantity -= item.quantity;
            await product.save({ session });

            // Create a snapshot of the item for the order
            orderItems.push({
                product: product._id,
                name: product.name,
                quantity: item.quantity,
                price: product.price,
                image: product.images[0],
            });
            totalAmount += item.quantity * product.price;
        }

        // 3. Create the order (within the transaction)
        const order = new Order({
            user: userId,
            orderItems,
            shippingAddress: address, // Embed the address snapshot
            totalAmount,
            paymentMethod: 'COD',
            paymentStatus: 'Pending (COD)',
        });
        await order.save({ session });

        // 4. Clear the user's cart (within the transaction)
        const userCart = await Cart.findById(cart._id).session(session);
        userCart.items = [];
        await userCart.save({ session });

        // 5. If all operations succeed, commit the transaction
        await session.commitTransaction();

        res.status(201).json({ message: 'Order placed successfully!', order });

    } catch (error) {
        // If any operation fails, abort the transaction
        await session.abortTransaction();
        console.error('Error creating COD order:', error);
        res.status(500).json({ message: error.message || 'Server error while placing order.' });
    } finally {
        // End the session
        session.endSession();
    }
};

// NOTE: The UPI order creation would follow the exact same transactional logic,
// just with different paymentMethod and transactionRef fields. For simplicity,
// we are focusing on the COD implementation here. The `createPendingUpiOrder`
// function can be built using the same template.
const createPendingUpiOrder = (req, res) => {
    res.status(501).json({ message: "UPI endpoint not yet implemented with Mongoose." });
};


const cancelOrderController = async (req, res) => {
    const { orderId } = req.params;
    const { userId } = req.userData;
    
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        // 1. Find the order within the transaction
        const order = await Order.findOne({ _id: orderId, user: userId }).session(session);

        if (!order) {
            throw new Error('Order not found or you do not have permission to cancel it.');
        }

        // Business logic for cancellation window
        const orderDate = new Date(order.createdAt);
        const now = new Date();
        const hoursDifference = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60);

        if (hoursDifference > 4) {
            throw new Error('The 4-hour cancellation window has passed.');
        }
        if (order.status === 'Cancelled' || order.status === 'Delivered') {
            throw new Error(`Order cannot be cancelled as it is already ${order.status}.`);
        }
        
        // 2. Restore stock for each item in the order (within the transaction)
        for (const item of order.orderItems) {
            await Product.updateOne(
                { _id: item.product },
                { $inc: { quantity: item.quantity } }
            ).session(session);
        }

        // 3. Update the order status (within the transaction)
        order.status = 'Cancelled';
        await order.save({ session });

        // 4. If all succeeds, commit the transaction
        await session.commitTransaction();

        res.status(200).json({ message: 'Order has been successfully cancelled.' });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error cancelling order:', error);
        res.status(500).json({ message: error.message || 'Failed to cancel order.' });
    } finally {
        session.endSession();
    }
};

module.exports = {
    getAllOrders,
    createPendingUpiOrder,
    createCashOnDeliveryOrder,
    getOrderStatus,
    getMyOrders,
    cancelOrderController,
    updateOrderStatus
};