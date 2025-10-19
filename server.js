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
const wishlistRoutes = require('./api/routes/wishlist.routes');

// Connect to MongoDB Atlas
connectDB();

const app = express();
const PORT = process.env.PORT || 5002;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
        process.env.FRONTEND_URL || 'https://aaisahebvastram.com',
        'http://localhost:3000',
        'https://www.aaisahebvastram.com' // Added www version for Socket.IO
    ],
    methods: ["GET", "POST"]
  }
});

// --- CORS Configuration ---

const allowedOrigins = [
    // This uses the environment variable, or the default if the variable is not set.
    process.env.FRONTEND_URL,
    'https://aaisahebvastram.com',
    'https://www.aaisahebvastram.com', // FIX: Explicitly added the 'www' domain which was failing.
    'http://localhost:3000',
].filter(Boolean); // .filter(Boolean) removes any null or undefined entries safely

const corsOptions = {
    origin: function (origin, callback) {
        // If the origin is null (e.g., direct API tool calls or same-origin requests in non-browser environments) or if it's in the allowed list, proceed.
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // This is the error handler that was triggered in your logs.
            console.error(`CORS Blocked: Request origin ${origin} not in allowed list.`);
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

// --- NEW: Middleware to make Socket.IO instance available in all routes ---
// This must be placed BEFORE your API routes.
app.use((req, res, next) => {
  req.io = io;
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
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use("/api/payment", paymentRoutes);
app.use('/api/wishlist', wishlistRoutes);


// --- REAL-TIME LOGIC (VISITORS & NOTIFICATIONS) ---
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
  // --- Existing Visitor Stats Logic ---
  onlineVisitors++;
  console.log(`A user connected. Total online: ${onlineVisitors}`);
  emitVisitorStats();

  // --- NEW: Admin Notification Room Logic ---
  // This listens for an admin client joining their dedicated room.
  socket.on('join_admin_room', () => {
    socket.join('admins');
    console.log(`Socket ${socket.id} joined the admin notification room.`);
  });

  // --- Existing Disconnect Logic ---
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
