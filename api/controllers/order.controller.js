const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const Order = require('../../models/order.model');
const User = require('../../models/user.model');
const Cart = require('../../models/cart.model');
const Product = require('../../models/product.model');

// --- IMPORTANT SCHEMA CHANGE NOTE ---
// To enable notifications, you must add a new field to your Order Schema in `order.model.js`.
// This field will track whether an admin has seen the order.
//
// Add the following line to your `orderSchema`:
//
// isNew: {
//   type: Boolean,
//   default: true,
// },
//
// --- END OF NOTE ---


// --- Utility function to convert numbers to words ---
const amountToWords = (num) => {
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    const inWords = (n, s) => {
        let str = '';
        if (n > 19) {
            str += b[Math.floor(n / 10)] + a[n % 10];
        } else {
            str += a[n];
        }
        if (n !== 0) {
            str += s;
        }
        return str;
    };

    let numberStr = num.toFixed(2).toString();
    let [rupees, paisa] = numberStr.split('.');
    rupees = parseInt(rupees);
    paisa = parseInt(paisa);

    let output = '';
    output += inWords(Math.floor(rupees / 10000000), 'crore ');
    rupees %= 10000000;
    output += inWords(Math.floor(rupees / 100000), 'lakh ');
    rupees %= 100000;
    output += inWords(Math.floor(rupees / 1000), 'thousand ');
    rupees %= 1000;
    output += inWords(Math.floor(rupees / 100), 'hundred ');
    rupees %= 100;
    output += inWords(rupees, '');

    if (output) {
        output += 'rupees ';
    }

    if (paisa > 0) {
        if (output) output += 'and ';
        output += inWords(paisa, 'paisa ');
    }
    
    if (!output.trim() && paisa === 0) {
        return "INR ZERO ONLY";
    }

    return "INR " + output.trim().replace(/\s+/g, ' ').toUpperCase() + " ONLY";
};


// --- Helper function to generate the invoice PDF ---
const generateInvoicePdf = (doc, order) => {
    // --- Calculations ---
    const taxableValue = order.orderItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    const cgstRate = 0.025;
    const sgstRate = 0.025;
    const cgst = taxableValue * cgstRate;
    const sgst = taxableValue * sgstRate;
    const totalTaxAmount = cgst + sgst;
    const grandTotal = order.totalAmount;
    const roundOff = grandTotal - (taxableValue + totalTaxAmount);

    // --- PDF Styling ---
    const pageMargin = 40;
    const contentWidth = doc.page.width - pageMargin * 2;
    const halfWidth = contentWidth / 2;

    // --- Header ---
    doc.font('Helvetica-Bold').fontSize(14).text('Tax Invoice', { align: 'center' });
    doc.font('Helvetica').fontSize(8).text('(DUPLICATE FOR TRANSPORTER)', pageMargin, doc.y - 12, { align: 'right' });
    doc.moveDown(1.5);

    // --- Seller & Invoice Details ---
    const topSectionY = doc.y;
    doc.fontSize(9).font('Helvetica-Bold').text('Appa Pan Shop', pageMargin, topSectionY, { width: halfWidth });
    doc.font('Helvetica').text('D/404, SILVER STONE, NEAR RECREATION HALL,', { width: halfWidth });
    doc.text('DEVARATNA COMPLEX, GANDHI STATUE, THANE', { width: halfWidth });
    doc.text('Thane - 416115, Maharashtra, India', { width: halfWidth });
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('GSTIN/UIN: ', { continued: true, width: halfWidth }).font('Helvetica').text('27AOPPP3212J1Z8');
    doc.font('Helvetica-Bold').text('State Name: ', { continued: true, width: halfWidth }).font('Helvetica').text('Maharashtra, Code: 27');
    doc.font('Helvetica-Bold').text('E-Mail: ', { continued: true, width: halfWidth }).font('Helvetica').text('aaisahebvastram@gmail.com');
    const leftHeight = doc.y;
    
    // Right side invoice details
    const rightColX = pageMargin + halfWidth;
    let detailsY = topSectionY;
    const labelWidth = 100;
    const valueWidth = halfWidth - labelWidth;

    const addDetail = (label, value) => {
        doc.font('Helvetica-Bold').text(label, rightColX, detailsY, { width: labelWidth, align: 'left' });
        doc.font('Helvetica').text(value || '', rightColX + labelWidth, detailsY, { width: valueWidth, align: 'left' });
        detailsY += 12;
    }

    addDetail('Invoice No.:', `CASH-${order._id.toString().slice(-5).toUpperCase()}`);
    addDetail('Dated:', new Date(order.createdAt).toLocaleDateString('en-GB'));
    addDetail('Mode/Terms of Payment:', order.paymentMethod);

    doc.y = Math.max(leftHeight, detailsY) + 10;
    doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(pageMargin, doc.y).lineTo(doc.page.width - pageMargin, doc.y).stroke();
    doc.moveDown(1);

    // --- Buyer and Consignee Details ---
    const addressY = doc.y;
    // Draw left column (Consignee)
    doc.font('Helvetica-Bold').text('Consignee (Ship to):', pageMargin, addressY, { width: halfWidth });
    doc.font('Helvetica').text(order.shippingAddress.name, { width: halfWidth });
    doc.text(`${order.shippingAddress.address}, ${order.shippingAddress.locality}`, { width: halfWidth });
    doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`, { width: halfWidth });
    doc.font('Helvetica-Bold').text('State Name: ', { continued: true }).font('Helvetica').text(`${order.shippingAddress.state}, Code: 27`);
    doc.font('Helvetica-Bold').text('Contact: ', { continued: true }).font('Helvetica').text(order.shippingAddress.mobile);
    const leftAddressHeight = doc.y;

    // Reset y to start of address section and draw right column (Buyer)
    doc.y = addressY;
    doc.font('Helvetica-Bold').text('Buyer (Bill to):', rightColX, addressY, { width: halfWidth });
    doc.font('Helvetica').text(order.shippingAddress.name, { width: halfWidth });
    doc.text(`${order.shippingAddress.address}, ${order.shippingAddress.locality}`, { width: halfWidth });
    doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`, { width: halfWidth });
    doc.font('Helvetica-Bold').text('State Name: ', { continued: true }).font('Helvetica').text(`${order.shippingAddress.state}, Code: 27`);
    doc.font('Helvetica-Bold').text('Contact: ', { continued: true }).font('Helvetica').text(order.shippingAddress.mobile);
    const rightAddressHeight = doc.y;

    // Set y to the bottom of the taller of the two columns
    doc.y = Math.max(leftAddressHeight, rightAddressHeight) + 10;

    doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(pageMargin, doc.y).lineTo(doc.page.width - pageMargin, doc.y).stroke();
    doc.moveDown(0.5);

    // --- Items Table ---
    const tableTop = doc.y + 10;
    const tableHeaders = {
        no: { x: pageMargin, width: 40, align: 'center' },
        desc: { x: pageMargin + 40, width: 180, align: 'left' },
        hsn: { x: pageMargin + 220, width: 70, align: 'center' },
        qty: { x: pageMargin + 290, width: 60, align: 'center' },
        rate: { x: pageMargin + 350, width: 60, align: 'right' },
        per: { x: pageMargin + 410, width: 40, align: 'center' },
        amt: { x: pageMargin + 450, width: contentWidth - 450, align: 'right' }
    };
    
    const drawTableRow = (y, items, isHeader = false) => {
        if (isHeader) doc.font('Helvetica-Bold');
        else doc.font('Helvetica');

        doc.text(items.no, tableHeaders.no.x, y, { width: tableHeaders.no.width, align: tableHeaders.no.align });
        doc.text(items.desc, tableHeaders.desc.x, y, { width: tableHeaders.desc.width, align: tableHeaders.desc.align });
        doc.text(items.hsn, tableHeaders.hsn.x, y, { width: tableHeaders.hsn.width, align: tableHeaders.hsn.align });
        doc.text(items.qty, tableHeaders.qty.x, y, { width: tableHeaders.qty.width, align: tableHeaders.qty.align });
        doc.text(items.rate, tableHeaders.rate.x, y, { width: tableHeaders.rate.width, align: tableHeaders.rate.align });
        doc.text(items.per, tableHeaders.per.x, y, { width: tableHeaders.per.width, align: tableHeaders.per.align });
        doc.text(items.amt, tableHeaders.amt.x, y, { width: tableHeaders.amt.width, align: tableHeaders.amt.align });
    };

    doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(pageMargin, tableTop - 5).lineTo(doc.page.width - pageMargin, tableTop - 5).stroke();
    let y = tableTop;
    drawTableRow(y, { no: 'Sl No.', desc: 'Description of Goods', hsn: 'HSN/SAC', qty: 'Quantity', rate: 'Rate', per: 'per', amt: 'Amount' }, true);
    y += 20;
    doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(pageMargin, y).lineTo(doc.page.width - pageMargin, y).stroke();
    y += 5;

    order.orderItems.forEach((item, index) => {
        const itemHeight = Math.max(15, doc.heightOfString(item.name, { width: tableHeaders.desc.width }));
        drawTableRow(y, {
            no: index + 1, desc: item.name, hsn: '108580', qty: `${item.quantity} PCS`, rate: `₹${item.price.toFixed(2)}`, per: 'PCS', amt: `₹${(item.quantity * item.price).toFixed(2)}`
        });
        y += itemHeight + 5;
    });
    
    doc.y = y > doc.y ? y : doc.y;
    y = doc.y + 10;
    doc.text('Less:', tableHeaders.no.x, y);

    const addTotalLine = (label, value) => {
        y += 15;
        doc.text(label, tableHeaders.rate.x, y, { width: tableHeaders.rate.width + tableHeaders.per.width - 10, align: 'right'});
        doc.text(value, tableHeaders.amt.x, y, { width: tableHeaders.amt.width, align: 'right'});
    }
    
    addTotalLine('S GST', `₹${sgst.toFixed(2)}`);
    addTotalLine('C GST', `₹${cgst.toFixed(2)}`);
    addTotalLine('ROUND OFF', `${roundOff.toFixed(2)}`);

    y += 10;
    doc.strokeColor('#aaaaaa').lineWidth(2).moveTo(pageMargin, y).lineTo(doc.page.width - pageMargin, y).stroke();
    y += 5;
    doc.font('Helvetica-Bold');
    doc.text('Total', tableHeaders.hsn.x, y, { width: tableHeaders.hsn.width + tableHeaders.qty.width - 70, align: 'right'});
    doc.text(`${order.orderItems.reduce((acc, item) => acc + item.quantity, 0)} PCS`, tableHeaders.qty.x, y, {width: tableHeaders.qty.width, align: 'center'});
    doc.fontSize(12).text(`₹${grandTotal.toFixed(2)}`, tableHeaders.amt.x, y, { width: tableHeaders.amt.width, align: 'right'});
    y += 20;
    doc.strokeColor('#aaaaaa').lineWidth(2).moveTo(pageMargin, y).lineTo(doc.page.width - pageMargin, y).stroke();
    y += 5;
    doc.y = y;

    // --- Tax Summary Table ---
    doc.fontSize(8).font('Helvetica-Bold').text('HSN/SAC', 50, y);
    doc.text('Taxable Value', 120, y);
    doc.text('CGST', 240, y);
    doc.text('SGST/UTGST', 360, y);
    doc.text('Total Tax', 480, y, {align: 'right'});
    y+=12;
    doc.strokeColor('#aaaaaa').lineWidth(0.5).moveTo(pageMargin, y).lineTo(doc.page.width - pageMargin, y).stroke();
    y+=5;

    doc.font('Helvetica');
    doc.text('108580', 50, y);
    doc.text(`₹${taxableValue.toFixed(2)}`, 120, y);
    doc.text(`2.50% | ₹${cgst.toFixed(2)}`, 240, y);
    doc.text(`2.50% | ₹${sgst.toFixed(2)}`, 360, y);
    doc.text(`₹${totalTaxAmount.toFixed(2)}`, 480, y, {align: 'right'});
    y = doc.y + 10;
    doc.y = y;

    // --- Footer ---
    doc.font('Helvetica-Bold').fontSize(9).text('Declaration', pageMargin, y, {underline: true});
    doc.font('Helvetica').text('We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', pageMargin, doc.y, {width: halfWidth});

    doc.font('Helvetica-Bold').text('for Appa Pan Shop', rightColX, y, {align: 'center', width: halfWidth});
    doc.strokeColor('#333333').lineWidth(1).moveTo(rightColX + 20, y + 60).lineTo(rightColX + halfWidth - 20, y + 60).stroke();
    doc.text('Authorised Signatory', rightColX, y + 65, {align: 'center', width: halfWidth});
    
    doc.fontSize(8).text('This is a Computer Generated Invoice', pageMargin, doc.page.height - 50, { align: 'center', width: contentWidth });
};



// --- Main Controller ---
const downloadInvoiceController = async (req, res) => {
    const { orderId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    try {
        const order = await Order.findById(orderId).populate('user', 'name');
        if (!order) {
            return res.status(404).json({ message: 'Invoice not found.' });
        }
        if (order.user._id.toString() !== userId.toString() && userRole !== 'admin') {
            return res.status(403).json({ message: 'You are not authorized to download this invoice.' });
        }
        
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice_${orderId}.pdf`);
        doc.pipe(res);

        generateInvoicePdf(doc, order);
        
        doc.end();
    } catch (error) {
        console.error('Invoice download error:', error);
        res.status(500).json({ message: 'Failed to download invoice. Please try again.' });
    }
};

const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate('user', 'name mobileNumber email')
            .populate({
                path: 'orderItems.product',
                model: 'Product',
                select: 'name images category'
            })
            .sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        console.error("Error fetching all orders:", error);
        res.status(500).json({ message: 'Server error while fetching orders.' });
    }
};

const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id })
            .populate({
                path: 'orderItems.product',
                model: 'Product',
                select: 'name images category'
            })
            .sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: "Server error while fetching user's orders." });
    }
};

const getOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    try {
        const order = await Order.findOne({ _id: orderId, user: req.user._id });
        if (!order) return res.status(404).json({ message: 'Order not found.' });
        res.status(200).json({ order });
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching order status.' });
    }
};

const updateOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: 'New status is required.' });
    try {
        const order = await Order.findByIdAndUpdate(orderId, { status, isNew: false }, { new: true });
        if (!order) return res.status(404).json({ message: 'Order not found.' });

        // --- REAL-TIME NOTIFICATION ---
        // Notify other connected admins that the status has changed.
        req.io.to('admins').emit('order_status_update', {
            message: `Admin updated order #${order._id.toString().slice(-5).toUpperCase()} to "${status}".`,
            order: order
        });
        
        res.status(200).json({ message: 'Order status updated successfully.', order });
    } catch (error) {
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
            orderItems.push({ 
                product: product._id, 
                name: product.name, 
                quantity: item.quantity, 
                price: product.price, 
                image: product.images[0]?.url || ''
            });
            totalAmount += item.quantity * product.price;
        }
        
        const taxableValue = totalAmount;
        const cgst = taxableValue * 0.025;
        const sgst = taxableValue * 0.025;
        const finalTotal = Math.round(taxableValue + cgst + sgst);

        const order = new Order({ user: userId, orderItems, shippingAddress: address, totalAmount: finalTotal, paymentMethod: 'COD', paymentStatus: 'Pending (COD)' });
        await order.save({ session });
        cart.items = [];
        await cart.save({ session });
        await session.commitTransaction();

        // --- REAL-TIME NOTIFICATION ---
        // Emit a 'new_order' event to the 'admins' room.
        req.io.to('admins').emit('new_order', {
          message: `New COD order #${order._id.toString().slice(-5).toUpperCase()} has been placed.`,
          order: order
        });

        res.status(201).json({ message: 'Order placed successfully!', order });
    } catch (error) {
        await session.abortTransaction();
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

        // --- REAL-TIME NOTIFICATION ---
        // Emit an 'order_status_update' event to the 'admins' room.
        req.io.to('admins').emit('order_status_update', {
            message: `Order #${order._id.toString().slice(-5).toUpperCase()} has been cancelled by the user.`,
            order: order
        });

        res.status(200).json({ message: 'Order has been successfully cancelled.' });
    } catch (error) {
        await session.abortTransaction();
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

        // --- REAL-TIME NOTIFICATION ---
        // Emit an 'order_status_update' event to the 'admins' room.
        req.io.to('admins').emit('order_status_update', {
            message: `A return has been requested for order #${order._id.toString().slice(-5).toUpperCase()}.`,
            order: order
        });

        res.status(200).json({ message: 'Return request submitted successfully.', order });
    } catch (error) {
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
    downloadInvoiceController,
};
