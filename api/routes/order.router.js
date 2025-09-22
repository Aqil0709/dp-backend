// backend/routes/order.routes.js

const express = require("express");
const router = express.Router();
const PDFDocument = require("pdfkit");
const Order = require("../models/order.model");
const { authenticate } = require("../middleware/auth.middleware");
const {
    getAllOrders,
    createUpiOrder,
    createCashOnDeliveryOrder,
    getOrderStatus,
    getMyOrders,
    cancelOrderController,
    updateOrderStatus,
    verifyUpiPayment,
} = require("../controllers/order.controller");

// --- Public route for UPI payment verification ---
router.post("/payment/verify", verifyUpiPayment);

// --- Authenticated routes ---
router.use(authenticate);

// --- Order creation ---
router.post("/cod/:userId", createCashOnDeliveryOrder);
router.post("/upi/:userId", createUpiOrder);

// --- User-specific orders ---
router.get("/myorders", getMyOrders);
router.get("/:orderId/status", getOrderStatus);
router.post("/:orderId/cancel", cancelOrderController);

// --- Admin-only route for updating order status ---
router.put("/:orderId/status", updateOrderStatus);
router.get("/", getAllOrders);

// --- Invoice download route ---
router.get("/:orderId/invoice", async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate("user", "name email");

        if (!order) return res.status(404).json({ message: "Order not found" });
        if (order.status !== "Delivered") {
            return res.status(400).json({ message: "Invoice is available only after delivery" });
        }

        // Create PDF
        const doc = new PDFDocument({ margin: 50 });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=invoice_${orderId}.pdf`
        );

        doc.pipe(res);

        // --- Header ---
        doc.fontSize(20).text("Invoice", { align: "center" });
        doc.moveDown();

        // --- Customer Info ---
        doc.fontSize(12).text(`Invoice No: ${order._id}`);
        doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`);
        doc.moveDown();
        doc.text(`Customer: ${order.user?.name || "N/A"}`);
        doc.text(`Email: ${order.user?.email || "N/A"}`);
        doc.moveDown();

        // --- Items ---
        doc.fontSize(12).text("Items:", { underline: true });
        doc.moveDown(0.5);
        order.orderItems.forEach((item, idx) => {
            doc.text(
                `${idx + 1}. ${item.name} - Qty: ${item.quantity} x ₹${item.price} = ₹${item.quantity * item.price}`
            );
        });

        // --- Total ---
        doc.moveDown();
        doc.fontSize(14).text(`Total: ₹${order.totalAmount}`, { align: "right" });

        // --- Footer ---
        doc.moveDown(2);
        doc.fontSize(10).text("Thank you for shopping with us!", { align: "center" });

        doc.end();
    } catch (error) {
        console.error("Invoice generation failed:", error);
        res.status(500).json({ message: "Server error generating invoice" });
    }
});

module.exports = router;
