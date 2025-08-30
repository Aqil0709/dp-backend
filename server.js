const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const connectDB = require('./config/db'); // 1. IMPORT the database connection

// Connect to MongoDB Atlas
connectDB(); // 2. CALL the connection function

// Import route handlers
const authRoutes = require('./api/auth/auth.routes');
const cartRoutes = require('./api/cart/cart.routes');
const profileRoutes = require('./api/profile/profile.routes');
// --- THIS IS THE FIX: The path now points to the file's actual location ---
const productRoutes = require('./api/products/products.routes'); 
const orderRoutes = require('./api/orders/order.routes');
const stockRoutes = require('./api/stock/stock.routes');
const userRoutes = require('./api/users/user.routes');
const adminRoutes = require('./api/admin/admin.routes');

const app = express();
const PORT = process.env.PORT || 5002;

// --- CORS Configuration ---
const allowedOrigins = [
    process.env.FRONTEND_URL || 'https://aaisahebvastram.com',
    'http://localhost:3000'
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));


// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Global Request Logger for Debugging ---
app.use((req, res, next) => {
    console.log(`[SERVER LOG] Request Received: ${req.method} ${req.originalUrl}`);
    next();
});

// --- API ROUTES ---
app.use('/auth', authRoutes);
app.use('/cart', cartRoutes);
app.use('/profile', profileRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/stock', stockRoutes);
app.use('/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Serve static files from the 'public' directory
app.use('/public', express.static(path.join(__dirname, 'public')));

// --- Fallback for any unhandled routes (404) ---
app.use((req, res, next) => {
    res.status(404).json({ message: 'API Route not found' });
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong on the server!', error: err.message });
});

// --- SERVER START ---
app.listen(PORT, () => {
    console.log(`Backend server is running on port ${PORT}`);
});

