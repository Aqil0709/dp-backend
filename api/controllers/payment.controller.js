const Razorpay = require("razorpay");
const crypto = require("crypto");
const Order = require("../../models/order.model");
const User = require("../../models/user.model");

console.log("Razorpay Key ID:", process.env.RAZORPAY_KEY_ID ? "Loaded" : "Missing");
console.log("Razorpay Key Secret:", process.env.RAZORPAY_KEY_SECRET ? "Loaded" : "Missing");
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 1. Create Razorpay Order
exports.createOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    const options = {
      amount: amount * 100, // convert to paise
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      order,
      key: process.env.RAZORPAY_KEY_ID,
      amount: options.amount,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ success: false, message: "Order creation failed" });
  }
};

// 2. Verify Razorpay Payment & Save Order
// 2. Verify Razorpay Payment & Save Order
exports.verifyPayment = async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature, 
      addressId, 
      cartItems, 
      totalAmount 
    } = req.body;

    // Signature verification
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    // ✅ Fetch address from user's saved addresses
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const address = user.addresses.id(addressId); // mongoose subdocument lookup
    if (!address) {
      return res.status(400).json({ success: false, message: "Address not found" });
    }

    // ✅ Map cart items → snapshot for order
    const orderItems = cartItems.map(item => ({
      product: item.product._id,
      name: item.product.name,
      quantity: item.quantity,
      price: item.product.price,
      image: item.product.images?.[0] || "",
    }));

    // ✅ Create order document
    const newOrder = new Order({
      user: req.user._id,
      orderItems,
      shippingAddress: {
        name: address.name,
        mobile: address.mobile,
        pincode: address.pincode,
        locality: address.locality,
        address: address.address,
        city: address.city,
        state: address.state,
        address_type: address.address_type,
      },
      totalAmount,
      paymentMethod: "UPI",
      paymentStatus: "Paid",
      transactionRef: razorpay_payment_id,
      status: "Processing",
    });

    await newOrder.save();

    res.json({ success: true, order: newOrder });
  } catch (error) {
    console.error("❌ Error verifying Razorpay payment:", error);
    res.status(500).json({ success: false, message: "Payment verification failed", error: error.message });
  }
};

