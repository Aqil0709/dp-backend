const mongoose = require('mongoose');
const Order = require('../../models/order.model');
const User = require('../../models/user.model');
const Cart = require('../../models/cart.model');
const Product = require('../../models/product.model');

const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate('user', 'name mobileNumber')
            .sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching all orders:', error);
        res.status(500).json({ message: 'Server error while fetching orders.' });
    }
};

const getMyOrders = async (req, res) => {
    try {
        // FIX: Changed req.userData.userId to req.user._id to match the auth middleware
        const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        console.error("Error in getMyOrders:", error);
        res.status(500).json({ message: "Server error while fetching user's orders." });
    }
};

const getOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    try {
        // FIX: Changed req.userData.userId to req.user._id
        const order = await Order.findOne({ _id: orderId, user: req.user._id });
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

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const user = await User.findById(userId).session(session);
        const cart = await Cart.findOne({ user: userId }).populate('items.product').session(session);

        if (!cart || cart.items.length === 0) {
            throw new Error('Cannot place an order with an empty cart.');
        }

        const address = user.addresses.id(deliveryAddressId);
        if (!address) {
            throw new Error('Delivery address not found.');
        }
        
        const orderItems = [];
        let totalAmount = 0;

        for (const item of cart.items) {
            const product = item.product; 

            if (!product || product.quantity < item.quantity) {
                throw new Error(`Insufficient stock for product "${product.name}".`);
            }

            await Product.updateOne(
                { _id: product._id },
                { $inc: { quantity: -item.quantity } },
                { session }
            );

            orderItems.push({
                product: product._id,
                name: product.name,
                quantity: item.quantity,
                price: product.price,
                image: product.images[0],
            });
            totalAmount += item.quantity * product.price;
        }

        const order = new Order({
            user: userId,
            orderItems,
            shippingAddress: address,
            totalAmount,
            paymentMethod: 'COD',
            paymentStatus: 'Pending (COD)',
        });
        await order.save({ session });

        cart.items = [];
        await cart.save({ session });

        await session.commitTransaction();

        res.status(201).json({ message: 'Order placed successfully!', order });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error creating COD order:', error);
        res.status(500).json({ message: error.message || 'Server error while placing order.' });
    } finally {
        session.endSession();
    }
};

const createPendingUpiOrder = (req, res) => {
    res.status(501).json({ message: "UPI endpoint not yet implemented with Mongoose." });
};


const cancelOrderController = async (req, res) => {
    const { orderId } = req.params;
    const userId = req.user._id;

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const order = await Order.findOne({ _id: orderId, user: userId }).session(session);

        if (!order) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Order not found.' });
        }

        // Refined status check: Only allow cancellation if the status is 'Processing'
        if (order.status !== 'Processing') {
            await session.abortTransaction();
            return res.status(400).json({ message: `Order cannot be cancelled as its status is '${order.status}'.` });
        }
        
        // --- FIX: Removed the 4-hour cancellation window check to allow all Processing orders to be cancelled.
        
        // Corrected loop with session option
        for (const item of order.orderItems) {
            await Product.updateOne(
                { _id: item.product },
                { $inc: { quantity: item.quantity } },
                { session } // <-- FIXED: Pass the session here
            );
        }

        order.status = 'Cancelled';
        await order.save({ session });

        await session.commitTransaction();

        res.status(200).json({ message: 'Order has been successfully cancelled.' });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error cancelling order:', error);
        res.status(500).json({ message: error.message || 'Failed to cancel order due to a server error.' });
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
