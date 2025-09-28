const mongoose = require('mongoose');
require('dotenv').config();

// --- ADD THESE LINES ---
// This ensures all models are registered with Mongoose before the database connects.
require('../models/user.model');
require('../models/product.model');
require('../models/cart.model');
require('../models/order.model');
require('../models/review.model');
// Add 'require' statements for any other models you have

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        // Exit process with failure
        process.exit(1);
    }
};

module.exports = connectDB;