const mongoose = require('mongoose');
const Order = require('../../models/order.model');
const User = require('../../models/user.model');
const Cart = require('../../models/cart.model');
const Product = require('../../models/product.model');
const Razorpay = require('razorpay');
const crypto = require('crypto'); // ⚠️ NEW: Required for signature verification

// Initialize Razorpay with API keys from environment variables
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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

        // Add COD fee for COD orders
        const codFee = 100;
        totalAmount += codFee;

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


// ⚠️ NEW: Function to create a Razorpay order
const createUpiOrder = async (req, res) => {
    const { userId } = req.params;
    const { deliveryAddressId } = req.body; // ⚠️ FIX: Correctly get deliveryAddressId from body

    try {
        const user = await User.findById(userId);
        const cart = await Cart.findOne({ user: userId }).populate('items.product');

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: 'Cannot place an order with an empty cart.' });
        }

        const address = user.addresses.id(deliveryAddressId);
        if (!address) {
            return res.status(400).json({ message: 'Delivery address not found.' });
        }

        let totalAmount = cart.items.reduce((sum, item) => sum + item.quantity * item.product.price, 0);

        // Create a new Razorpay order
        const options = {
            amount: totalAmount * 100, // amount in paisa
            currency: "INR",
            receipt: `receipt_order_${Date.now()}`,
            payment_capture: 1, // Auto capture payment
        };

        const rzpOrder = await razorpayInstance.orders.create(options);

        // Create a pending order in your database
        const newOrder = new Order({
            user: userId,
            orderItems: cart.items.map(item => ({
                product: item.product._id,
                name: item.product.name,
                quantity: item.quantity,
                price: item.product.price,
                image: item.product.images[0],
            })),
            shippingAddress: address,
            totalAmount,
            paymentMethod: 'UPI',
            paymentStatus: 'Pending',
            razorpayOrderId: rzpOrder.id,
        });

        await newOrder.save();

        res.status(200).json({ 
            message: 'Razorpay order created successfully.',
            orderId: rzpOrder.id,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency,
        });
    } catch (error) {
        console.error('Error creating UPI order:', error);
        res.status(500).json({ message: error.message || 'Server error while creating UPI order.' });
    }
};


const cancelOrderController = async (req, res) => {
    const { orderId } = req.params;
    // FIX: Changed from req.userData to req.user._id
    const userId = req.user._id;
    
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const order = await Order.findOne({ _id: orderId, user: userId }).session(session);

        if (!order) {
            throw new Error('Order not found or you do not have permission to cancel it.');
        }

        const orderDate = new Date(order.createdAt);
        const now = new Date();
        const hoursDifference = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60);

        if (hoursDifference > 4) {
            throw new Error('The 4-hour cancellation window has passed.');
        }
        if (order.status === 'Cancelled' || order.status === 'Delivered') {
            throw new Error(`Order cannot be cancelled as it is already ${order.status}.`);
        }
        
        for (const item of order.orderItems) {
            await Product.updateOne(
                { _id: item.product },
                { $inc: { quantity: item.quantity } }
            ).session(session);
        }

        order.status = 'Cancelled';
        await order.save({ session });

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

// ⚠️ NEW: A verification endpoint is required to finalize the order after payment.
const verifyUpiPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

    if (expectedSignature === razorpay_signature) {
        try {
            // Find the pending order in your database and update its status
            const order = await Order.findOneAndUpdate(
                { razorpayOrderId: razorpay_order_id },
                { paymentStatus: 'Paid', status: 'Processing' },
                { new: true }
            );

            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found for verification.' });
            }

            // Clear the user's cart after successful payment and stock update
            await Cart.findOneAndUpdate({ user: order.user }, { items: [] });
            
            res.status(200).json({ success: true, message: 'Payment verified and order finalized.' });
        } catch (error) {
            console.error('Error verifying payment or finalizing order:', error);
            res.status(500).json({ success: false, message: 'Internal server error during payment verification.' });
        }
    } else {
        res.status(400).json({ success: false, message: 'Invalid payment signature.' });
    }
};


module.exports = {
    getAllOrders,
    createUpiOrder, // ⚠️ Replaced old placeholder
    createCashOnDeliveryOrder,
    getOrderStatus,
    getMyOrders,
    cancelOrderController,
    updateOrderStatus,
    verifyUpiPayment, // ⚠️ New export
};
