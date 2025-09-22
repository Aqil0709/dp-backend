const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const Order = require('../../models/order.model');
const User = require('../../models/user.model');
const Cart = require('../../models/cart.model');
const Product = require('../../models/product.model');


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
    doc.fontSize(9).font('Helvetica-Bold').text('AAISAHEB VASTRAM', pageMargin, topSectionY, { width: halfWidth });
    doc.font('Helvetica').text('D/404, SILVER STONE, NEAR RECREATION HALL,', { width: halfWidth });
    doc.text('DEVARATNA COMPLEX, GANDHI STATUE, THANE', { width: halfWidth });
    doc.text('Thane - 416115, Maharashtra, India', { width: halfWidth });
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('GSTIN/UIN: ', { continued: true, width: halfWidth }).font('Helvetica').text('27AOPPP3212J1Z8');
    doc.font('Helvetica-Bold').text('State Name: ', { continued: true, width: halfWidth }).font('Helvetica').text('Maharashtra, Code: 27');
    doc.font('Helvetica-Bold').text('E-Mail: ', { continued: true, width: halfWidth }).font('Helvetica').text('aaisahebvastram@gmail.com');
    const leftHeight = doc.y;
    doc.y = topSectionY;
    
    // Right side invoice details
    const rightColX = pageMargin + halfWidth;
    let detailsY = topSectionY;
    const labelWidth = 100;
    const valueWidth = halfWidth - labelWidth;

    const addDetail = (label, value) => {
        doc.font('Helvetica-Bold').text(label, rightColX, detailsY, { width: labelWidth, align: 'left' });
        doc.font('Helvetica').text(value, rightColX + labelWidth, detailsY, { width: valueWidth, align: 'left' });
        detailsY += 12;
    }

    addDetail('Invoice No.:', `CASH-${order._id.toString().slice(-5).toUpperCase()}`);
    addDetail('Dated:', new Date(order.createdAt).toLocaleDateString('en-GB'));
    addDetail('Delivery Note:', '');
    addDetail('Mode/Terms of Payment:', order.paymentMethod);
    addDetail('Reference No. & Date:', '');
    addDetail('Other References:', '');
    addDetail("Buyer's Order No.:", '');
    addDetail("Dated:", '');
    addDetail("Dispatch Doc No:", '');
    addDetail("Delivery Note Date:", '');
    addDetail("Dispatched through:", '');
    addDetail("Destination:", '');
    addDetail("Terms of Delivery:", '');

    doc.y = Math.max(leftHeight, detailsY) + 10;
    doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(pageMargin, doc.y).lineTo(doc.page.width - pageMargin, doc.y).stroke();
    doc.moveDown(1);

    // --- Buyer and Consignee Details ---
    const addressY = doc.y;
    doc.font('Helvetica-Bold').text('Consignee (Ship to):', pageMargin, addressY, { width: halfWidth });
    doc.font('Helvetica').text(order.shippingAddress.name, { width: halfWidth });
    doc.text(`${order.shippingAddress.address}, ${order.shippingAddress.locality}`, { width: halfWidth });
    doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`, { width: halfWidth });
    doc.font('Helvetica-Bold').text('State Name: ', { continued: true }).font('Helvetica').text(`${order.shippingAddress.state}, Code: 27`);
    doc.font('Helvetica-Bold').text('Contact: ', { continued: true }).font('Helvetica').text(order.shippingAddress.mobile);

    doc.font('Helvetica-Bold').text('Buyer (Bill to):', rightColX, addressY, { width: halfWidth });
    doc.font('Helvetica').text(order.shippingAddress.name, rightColX, doc.y - 36, { width: halfWidth }); // Adjust Y
    doc.text(`${order.shippingAddress.address}, ${order.shippingAddress.locality}`, rightColX, doc.y, { width: halfWidth });
    doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`, rightColX, doc.y, { width: halfWidth });
    doc.font('Helvetica-Bold').text('State Name: ', rightColX, doc.y, { continued: true, width: halfWidth }).font('Helvetica').text(`${order.shippingAddress.state}, Code: 27`);
    doc.font('Helvetica-Bold').text('Contact: ', rightColX, doc.y, { continued: true, width: halfWidth }).font('Helvetica').text(order.shippingAddress.mobile);
    
    doc.moveDown(2);
    doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(pageMargin, doc.y).lineTo(doc.page.width - pageMargin, doc.y).stroke();
    doc.moveDown(0.5);

    // --- Items Table ---
    const tableTop = doc.y;
    const itemCols = { no: 50, desc: 100, hsn: 240, qty: 310, rate: 360, per: 430, amt: 480 };
    doc.font('Helvetica-Bold');
    doc.text('Sl No.', itemCols.no, tableTop);
    doc.text('Description of Goods', itemCols.desc, tableTop);
    doc.text('HSN/SAC', itemCols.hsn, tableTop, { align: 'center'});
    doc.text('Quantity', itemCols.qty, tableTop, { align: 'center'});
    doc.text('Rate', itemCols.rate, tableTop, { align: 'right'});
    doc.text('per', itemCols.per, tableTop, { align: 'center'});
    doc.text('Amount', 0, tableTop, { align: 'right', width: contentWidth + 10 });
    doc.moveDown(1);
    const tableHeaderY = doc.y;
    doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(pageMargin, tableTop - 5).lineTo(doc.page.width - pageMargin, tableTop - 5).stroke(); // Top border
    doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(pageMargin, tableHeaderY).lineTo(doc.page.width - pageMargin, tableHeaderY).stroke(); // Bottom border of header

    let y = tableHeaderY;
    doc.font('Helvetica');
    order.orderItems.forEach((item, index) => {
        y += 15;
        doc.text(index + 1, itemCols.no, y, {width: 50, align: 'center'});
        doc.text(item.name, itemCols.desc, y, {width: 130});
        doc.text('108580', itemCols.hsn, y, {width: 60, align: 'center'});
        doc.text(`${item.quantity} PCS`, itemCols.qty, y, {width: 60, align: 'center'});
        doc.text(`₹${item.price.toFixed(2)}`, itemCols.rate, y, {width: 60, align: 'right'});
        doc.text('PCS', itemCols.per, y, {width: 50, align: 'center'});
        doc.text(`₹${(item.quantity * item.price).toFixed(2)}`, 0, y, {width: contentWidth+10, align: 'right' });
    });
    
    y += 20;
    doc.text('Less:', itemCols.no, y);

    const addTotalLine = (label, value) => {
        y += 15;
        doc.text(label, itemCols.per, y, {width: 50, align: 'right'});
        doc.text(value, 0, y, {width: contentWidth + 10, align: 'right'});
    }
    
    addTotalLine('S GST', `₹${sgst.toFixed(2)}`);
    addTotalLine('C GST', `₹${cgst.toFixed(2)}`);
    addTotalLine('ROUND OFF', `${roundOff.toFixed(2)}`);

    y += 10;
    doc.strokeColor('#aaaaaa').lineWidth(2).moveTo(pageMargin, y).lineTo(doc.page.width - pageMargin, y).stroke();
    y += 5;
    doc.font('Helvetica-Bold');
    doc.text('Total', itemCols.hsn, y, { align: 'right', width: 220});
    doc.text(`${order.orderItems.reduce((acc, item) => acc + item.quantity, 0)} PCS`, itemCols.qty, y, {width: 60, align: 'center'});
    doc.fontSize(12).text(`₹${grandTotal.toFixed(2)}`, 0, y, {width: contentWidth + 10, align: 'right'});
    y += 20;
    doc.strokeColor('#aaaaaa').lineWidth(2).moveTo(pageMargin, y).lineTo(doc.page.width - pageMargin, y).stroke();
    y += 5;

    // --- Amount in Words ---
    doc.fontSize(9).font('Helvetica').text(`Amount Chargeable (in words): ${amountToWords(grandTotal)}`);
    y = doc.y + 10;
    doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(pageMargin, y).lineTo(doc.page.width - pageMargin, y).stroke();
    y += 10;

    // --- Tax Summary Table ---
    // This is a simplified version due to pdfkit's limitations with complex tables.
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

    // --- Tax in Words ---
    doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(pageMargin, y).lineTo(doc.page.width - pageMargin, y).stroke();
    y += 5;
    doc.fontSize(9).text(`Tax Amount (in words): ${amountToWords(totalTaxAmount)}`);
    y = doc.y + 20;


    // --- Footer ---
    doc.font('Helvetica-Bold').fontSize(9).text('Declaration', pageMargin, y, {underline: true});
    doc.font('Helvetica').text('We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', pageMargin, doc.y, {width: halfWidth});

    doc.font('Helvetica-Bold').text('for AAISAHEB VASTRAM', rightColX, y, {align: 'center', width: halfWidth});
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
        const orders = await Order.find({}).populate('user', 'name mobileNumber').sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching orders.' });
    }
};

const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
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
        const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true });
        if (!order) return res.status(404).json({ message: 'Order not found.' });
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
            orderItems.push({ product: product._id, name: product.name, quantity: item.quantity, price: product.price, image: product.images[0] });
            totalAmount += item.quantity * product.price;
        }
        
        // --- ADD GST & ROUND OFF TO TOTAL ---
        const taxableValue = totalAmount;
        const cgst = taxableValue * 0.025;
        const sgst = taxableValue * 0.025;
        const finalTotal = Math.round(taxableValue + cgst + sgst);


        const order = new Order({ user: userId, orderItems, shippingAddress: address, totalAmount: finalTotal, paymentMethod: 'COD', paymentStatus: 'Pending (COD)' });
        await order.save({ session });
        cart.items = [];
        await cart.save({ session });
        await session.commitTransaction();
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
