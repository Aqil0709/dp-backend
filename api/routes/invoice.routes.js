const express = require("express");
const PDFDocument = require("pdfkit");
const Order = require("../models/order.model"); // adjust path as per your project

const router = express.Router();

// GET /api/orders/:id/invoice
router.get("/:id/invoice", async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId)
            .populate("user", "name email") // assuming you store user info
            .populate("orderItems.product", "name price"); // assuming orderItems have product refs

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        if (order.status !== "Delivered") {
            return res.status(400).json({ message: "Invoice is available only after delivery" });
        }

        // Create a PDF document
        const doc = new PDFDocument({ margin: 50 });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=invoice_${orderId}.pdf`
        );

        doc.pipe(res);

        // Header
        doc.fontSize(20).text("Invoice", { align: "center" });
        doc.moveDown();

        // Order & Customer Info
        doc.fontSize(12).text(`Invoice No: ${order._id}`);
        doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`);
        doc.moveDown();
        doc.text(`Customer: ${order.user?.name || "N/A"}`);
        doc.text(`Email: ${order.user?.email || "N/A"}`);
        doc.moveDown();

        // Table Header
        doc.fontSize(12).text("Items:", { underline: true });
        doc.moveDown(0.5);

        // Table Rows
        order.orderItems.forEach((item, idx) => {
            doc.text(
                `${idx + 1}. ${item.product?.name || "Product"} - Qty: ${
                    item.qty
                } x ₹${item.price} = ₹${item.qty * item.price}`
            );
        });

        doc.moveDown();
        doc.fontSize(14).text(`Total: ₹${order.totalPrice}`, { align: "right" });

        // Footer
        doc.moveDown(2);
        doc.fontSize(10).text("Thank you for shopping with us!", {
            align: "center",
        });

        doc.end();
    } catch (error) {
        console.error("Invoice generation failed:", error);
        res.status(500).json({ message: "Server error generating invoice" });
    }
});

module.exports = router;
