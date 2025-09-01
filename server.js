const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const compression = require('compression'); // Import the compression middleware
const cluster = require('cluster'); // Import the cluster module
const os = require('os'); // Import the os module

const connectDB = require('./config/db');

// --- (Your existing route imports) ---
const authRoutes = require('./api/auth/auth.routes');
const cartRoutes = require('./api/cart/cart.routes');
const profileRoutes = require('./api/profile/profile.routes');
const productRoutes = require('./api/products/products.routes');
const orderRoutes = require('./api/orders/order.routes');
const stockRoutes = require('./api/stock/stock.routes');
const userRoutes = require('./api/users/user.routes');
const adminRoutes = require('./api/admin/admin.routes');

const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  console.log(`Master process ${process.pid} is running`);

  // Fork workers for each CPU core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker process ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  // Connect to MongoDB Atlas
  connectDB();

  const app = express();
  const PORT = process.env.PORT || 5002;

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: [process.env.FRONTEND_URL || 'https://aaisahebvastram.com', 'http://localhost:3000'],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      credentials: true
    }
  });

  // Use CORS middleware for all routes
  app.use(cors());

  // Use compression middleware for all responses
  app.use(compression());

  // --- API ROUTES with versioning and specific middleware ---
  app.use('/api/v1/auth', express.json(), express.urlencoded({ extended: true }), authRoutes);
  app.use('/api/v1/cart', express.json(), express.urlencoded({ extended: true }), cartRoutes);
  app.use('/api/v1/profile', express.json(), express.urlencoded({ extended: true }), profileRoutes);
  app.use('/api/v1/products', productRoutes);
  app.use('/api/v1/orders', express.json(), express.urlencoded({ extended: true }), orderRoutes);
  app.use('/api/v1/stock', express.json(), express.urlencoded({ extended: true }), stockRoutes);
  app.use('/api/v1/users', express.json(), express.urlencoded({ extended: true }), userRoutes);
  app.use('/api/v1/admin', express.json(), express.urlencoded({ extended: true }), adminRoutes);

  // Static file serving
  app.use('/public', express.static(path.join(__dirname, 'public')));


  // --- REAL-TIME VISITOR STATS LOGIC ---
  let onlineVisitors = 0;
  // In a real application, you would fetch this from a database.
  // For now, we'll simulate it similarly to how the frontend did.
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

    // Send the latest stats to all clients immediately
    emitVisitorStats();

    socket.on('disconnect', () => {
      onlineVisitors--;
      console.log(`A user disconnected. Total online: ${onlineVisitors}`);

      // Send the updated stats to all remaining clients
      emitVisitorStats();
    });
  });


  // --- Fallback and Error Handler (Your existing handlers) ---
  app.use((req, res, next) => {
    res.status(404).json({ message: 'API Route not found' });
  });
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
  });


  // --- SERVER START (Use the http server, not the app) ---
  server.listen(PORT, () => {
    console.log(`Worker process ${process.pid} listening on port ${PORT}`);
  });
}
