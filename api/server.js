// --- server.js ---

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");

const connectDB = require('./config/db');

// Route imports
const authRoutes = require('./api/auth/auth.routes');
const cartRoutes = require('./api/cart/cart.routes');
const profileRoutes = require('./api/profile/profile.routes');
const productRoutes = require('./api/products/products.routes');
const orderRoutes = require('./api/orders/order.routes');
const stockRoutes = require('./api/stock/stock.routes');
const userRoutes = require('./api/users/user.routes');
const adminRoutes = require('./api/admin/admin.routes');
const paymentRoutes = require("./api/routes/payment.routes");
// --- FIX: Corrected the path to the wishlist routes file for consistency ---
const wishlistRoutes = require('./api/routes/wishlist.routes'); 
const invoiceRoutes = require("./api/routes/invoice.routes");




// Connect to MongoDB Atlas
connectDB();

const app = express();
const PORT = process.env.PORT || 5002;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [process.env.FRONTEND_URL || 'https://aaisahebvastram.com', 'http://localhost:3000'],
    methods: ["GET", "POST"]
  }
});

// --- CORS Configuration ---
const allowedOrigins = [
    process.env.FRONTEND_URL || 'https://aaisahebvastram.com',
    'http://localhost:3000'
];
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- API ROUTES ---
app.use('/auth', authRoutes);
app.use('/cart', cartRoutes);
app.use('/profile', profileRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/stock', stockRoutes);
app.use('/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use("/api/payment", paymentRoutes);
app.use("/api/orders", invoiceRoutes);
// --- Use the wishlist routes with the correct prefix ---
app.use('/api/wishlist', wishlistRoutes);


// --- REAL-TIME VISITOR STATS LOGIC ---
let onlineVisitors = 0;
const getMonthlyVisitors = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthlySeed = (year * 12 + month);
    const monthlyFluctuation = (monthlySeed * 137) % 5000;
    return 11000 + monthlyFluctuation;
};

const emitVisitorStats = () => {
    const stats = {
        online: onlineVisitors,
        monthly: getMonthlyVisitors()
    };
    io.emit('visitorStatsUpdate', stats);
};

io.on('connection', (socket) => {
  onlineVisitors++;
  console.log(`A user connected. Total online: ${onlineVisitors}`);
  emitVisitorStats();

  socket.on('disconnect', () => {
    onlineVisitors--;
    console.log(`A user disconnected. Total online: ${onlineVisitors}`);
    emitVisitorStats();
  });
});

// --- Fallback and Error Handler ---
app.use((req, res, next) => {
    res.status(404).json({ message: 'API Route not found' });
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// --- SERVER START ---
server.listen(PORT, () => {
    console.log(`Backend server with real-time support is running on port ${PORT}`);
});

