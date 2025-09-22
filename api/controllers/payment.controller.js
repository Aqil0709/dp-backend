const Razorpay = require("razorpay");
const crypto = require("crypto");
const Order = require("../../models/order.model");
const User = require("../../models/user.model");

// --- Environment Variable Check ---
// This check is crucial. If the keys are missing, we stop the server immediately
// to prevent it from crashing when trying to initialize Razorpay.
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error("FATAL ERROR: Razorpay Key ID or Key Secret is not defined in your .env file.");
  process.exit(1); // Exit the application
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 1. Create Razorpay Order
exports.createOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ success: false, message: "Invalid amount provided." });
    }

    const options = {
      amount: amount * 100, // convert to paise
      currency: "INR",
      receipt: "receipt_" + crypto.randomBytes(10).toString('hex'), // A more unique receipt
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      order,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ success: false, message: "Order creation failed" });
  }
};


// 2. Verify Razorpay Payment & Save Order
exports.verifyPayment = async (req, res) => {
  console.log("Starting payment verification...");
  
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    addressId,
    cartItems,
    totalAmount
  } = req.body;

  // --- Input Validation ---
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: "Missing payment credentials." });
  }
  
  try {
    // --- Signature Verification ---
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      console.warn("Signature mismatch. Expected:", expectedSign, "Got:", razorpay_signature);
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }
    console.log("✅ Signature verified successfully.");

    // --- Authentication and Data Integrity Checks ---
    if (!req.user || !req.user._id) {
      console.error("Authentication error: req.user is not defined. Ensure auth middleware is used on this route.");
      return res.status(401).json({ success: false, message: "User not authenticated." });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    console.log(`✅ User found: ${user.email}`);

    const address = user.addresses.id(addressId);
    if (!address) {
      console.error(`Address with ID: ${addressId} not found for user.`);
      return res.status(400).json({ success: false, message: "Address not found" });
    }
    console.log("✅ Address found.");
    
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        console.error("Validation error: cartItems is missing, not an array, or empty.");
        return res.status(400).json({ success: false, message: "Invalid cart items provided." });
    }

    // --- Create Order Document ---
    const orderItems = cartItems.map(item => {
        if (!item.product || !item.product._id) {
            // This error should be caught properly to avoid crashing the server
            throw new Error(`Cart item is missing product details. Item: ${JSON.stringify(item)}`);
        }
        return {
            product: item.product._id,
            name: item.product.name,
            quantity: item.quantity,
            price: item.product.price,
            image: item.product.images?.[0] || "",
        };
    });
     console.log("✅ Cart items mapped.");

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
      paymentMethod: "Razorpay", // Be more specific
      paymentStatus: "Paid",
      transactionRef: razorpay_payment_id,
      status: "Processing",
    });

    await newOrder.save();
    console.log("✅ New order saved to database with ID:", newOrder._id);

    // --- Clear the user's cart after successful order ---
    user.cart = [];
    await user.save({ validateBeforeSave: false }); // Avoids potential validation issues on other fields
    console.log(`✅ Cleared cart for user: ${user.email}`);

    res.json({ success: true, orderId: newOrder._id, message: "Payment successful and order placed." });

  } catch (error) {
    console.error("❌ Error during payment verification:", error);
    res.status(500).json({ success: false, message: "Payment verification failed", error: error.message });
  }
};

