const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const Order = require('../../models/order.model');
const User = require('../../models/user.model');
const Cart = require('../../models/cart.model');
const Product = require('../../models/product.model');

// --- Helper function to format address ---
const formatAddress = (address) => {
    let parts = [
        address.name,
        address.address,
        `${address.locality}, ${address.city}, ${address.state} - ${address.pincode}`,
        `Mobile: ${address.mobile}`
    ];
    return parts.filter(Boolean).join('\n');
};


// --- Helper function to generate table rows in the PDF ---
const generateTableRow = (doc, y, c1, c2, c3, c4, c5) => {
    doc.fontSize(10)
        .text(c1, 50, y)
        .text(c2, 150, y)
        .text(c3, 280, y, { width: 90, align: 'right' })
        .text(c4, 370, y, { width: 90, align: 'right' })
        .text(c5, 0, y, { align: 'right' });
};


// NEW: Controller to generate and download an invoice PDF
const downloadInvoiceController = async (req, res) => {
    const { orderId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    try {
        const order = await Order.findById(orderId).populate('user', 'name');

        if (!order) {
            return res.status(404).json({ message: 'Invoice not found.' });
        }

        // Security Check: Ensure the user owns the order or is an admin
        if (order.user._id.toString() !== userId.toString() && userRole !== 'admin') {
            return res.status(403).json({ message: 'You are not authorized to download this invoice.' });
        }
        
        // --- PDF Generation using pdfkit ---
        const doc = new PDFDocument({ size: 'A4', margin: 50 });

        // Set response headers to trigger download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice_${orderId}.pdf`);
        doc.pipe(res);

        // Header Section
        doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
        doc.moveDown();

        // Company & Customer Details
        doc.fontSize(12).font('Helvetica-Bold').text('ShopKart Inc.', { continued: true });
        doc.font('Helvetica').text('                                                                                ', { continued: true });
        doc.font('Helvetica-Bold').text(`Bill To: ${order.shippingAddress.name}`);
        doc.font('Helvetica').text('123 Tech Lane, Gadget City, 110011', { continued: true });
        doc.text(`                                                                 ${formatAddress(order.shippingAddress)}`);
        
        doc.moveDown(2);

        // Order Meta Information
        const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN');
        doc.fontSize(12).font('Helvetica-Bold').text(`Invoice ID:`, { continued: true });
        doc.font('Helvetica').text(` ${order._id}`);
        doc.font('Helvetica-Bold').text(`Order Date:`, { continued: true });
        doc.font('Helvetica').text(` ${orderDate}`);
        
        doc.moveDown(2);

        // Invoice Table Header
        doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        generateTableRow(doc, doc.y + 5, "Item", "Description", "Quantity", "Unit Price", "Total Price");
        doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, doc.y + 20).lineTo(550, doc.y + 20).stroke();
        doc.moveDown();

        // Invoice Table Rows
        let position = doc.y + 10;
        order.orderItems.forEach(item => {
            const itemTotal = (item.price * item.quantity).toFixed(2);
            generateTableRow(
                doc,
                position,
                item.product.toString().substring(0, 8) + '...', // Shortened product ID
                item.name,
                item.quantity,
                `Rs. ${item.price.toFixed(2)}`,
                `Rs. ${itemTotal}`
            );
            position += 25;
        });

        // Total Section
        doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, position).lineTo(550, position).stroke();
        position += 15;
        doc.fontSize(14).font('Helvetica-Bold').text('Grand Total:', 50, position, { align: 'right', width: 410 });
        doc.fontSize(14).font('Helvetica-Bold').text(`Rs. ${order.totalAmount.toFixed(2)}`, 0, position, { align: 'right' });

        doc.moveDown(4);

        // Footer
        doc.fontSize(10).font('Helvetica-Oblique').text('Thank you for your business!', { align: 'center', width: 500 });

        // Finalize the PDF and end the stream
        doc.end();
        
    } catch (error) {
        console.error('Invoice download error:', error);
        res.status(500).json({ message: 'Failed to download invoice. Please try again.' });
    }
};


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
        const order = await Order.findOne({ _id: orderId, user: req.user._id });
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        res.status(200).json({ order });
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

const createCashOnDeliveryOrder = async (req, res) => {
    const { userId } = req.params;
    const { deliveryAddressId } = req.body;
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const user = await User.findById(userId).session(session);
        const cart = await Cart.findOne({ user: userId }).populate('items.product').session(session);
        if (!cart || cart.items.length === 0) throw new Error('Cannot place an order with an empty cart.');
        const address = user.addresses.id(deliveryAddressId);
        if (!address) throw new Error('Delivery address not found.');
        
        const orderItems = [];
        let totalAmount = 0;
        for (const item of cart.items) {
            const product = item.product; 
            if (!product || product.quantity < item.quantity) throw new Error(`Insufficient stock for product "${product.name}".`);
            await Product.updateOne({ _id: product._id }, { $inc: { quantity: -item.quantity } }, { session });
            orderItems.push({ product: product._id, name: product.name, quantity: item.quantity, price: product.price, image: product.images[0] });
            totalAmount += item.quantity * product.price;
        }

        const order = new Order({ user: userId, orderItems, shippingAddress: address, totalAmount, paymentMethod: 'COD', paymentStatus: 'Pending (COD)' });
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
        if (!order) throw new Error('Order not found or you do not have permission to cancel it.');
        const orderDate = new Date(order.createdAt);
        const now = new Date();
        const hoursDifference = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60);
        if (hoursDifference > 4) throw new Error('The 4-hour cancellation window has passed.');
        if (order.status === 'Cancelled' || order.status === 'Delivered') throw new Error(`Order cannot be cancelled as it is already ${order.status}.`);
        for (const item of order.orderItems) {
            await Product.updateOne({ _id: item.product }, { $inc: { quantity: item.quantity } }).session(session);
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

const returnOrderController = async (req, res) => {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;
    if (!reason) return res.status(400).json({ message: 'A reason for return is required.' });
    try {
        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order) return res.status(404).json({ message: 'Order not found or you do not have permission to return it.' });
        if (order.status !== 'Delivered') return res.status(400).json({ message: `Order can only be returned after it has been delivered. Current status: ${order.status}` });
        order.status = 'Return Requested';
        order.returnReason = reason;
        await order.save();
        res.status(200).json({ message: 'Return request submitted successfully.', order });
    } catch (error) {
        console.error('Error submitting return request:', error);
        res.status(500).json({ message: error.message || 'Failed to submit return request.' });
    }
};

module.exports = {
    getAllOrders,
    createPendingUpiOrder,
    createCashOnDeliveryOrder,
    getOrderStatus,
    getMyOrders,
    cancelOrderController,
    updateOrderStatus,
    returnOrderController,
    downloadInvoiceController, // NEW: Export the invoice controller
};
