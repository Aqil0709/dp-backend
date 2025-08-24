// backend/api/middleware/auth.middleware.js
const jwt = require('jsonwebtoken'); // Assuming you're using JWTs

console.log('--- Loading auth.middleware.js ---'); // Debugging log

// Middleware to authenticate any user (verify token and attach user data)
const authenticate = (req, res, next) => {
    console.log("Auth Middleware: Incoming request for authentication...");
    try {
        // Get token from header: "Bearer TOKEN_STRING"
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        console.log("Auth Middleware: Received Authorization Header:", authHeader);
        console.log("Auth Middleware: Extracted Token:", token ? "Token present" : "No token extracted");

        if (!token) {
            console.log("Auth Middleware: No token provided. Sending 401.");
            return res.status(401).json({ message: 'Authentication required: No token provided.' });
        }

        // Verify the token
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET); // Use your secret key from .env
        console.log("Auth Middleware: Token decoded successfully. Decoded Payload:", decodedToken);

        // Attach user data (userId and role) to the request object
        req.userData = { userId: decodedToken.userId, role: decodedToken.role };
        console.log("Auth Middleware: req.userData set to:", req.userData);

        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        console.error("Auth Middleware: Authentication error:", error.message); // More specific error log
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token.' });
        }
        return res.status(401).json({ message: 'Authentication failed.' });
    }
};

// Middleware to authorize only admin users
const authorizeAdmin = (req, res, next) => {
    // This middleware assumes 'authenticate' has already run and attached req.userData
    console.log("Auth Middleware: Authorize Admin check. req.userData:", req.userData);
    if (!req.userData || req.userData.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: You are not authorized to perform this action.' });
    }
    next(); // User is an admin, proceed
};

// Export both functions as properties of an object
module.exports = { authenticate, authorizeAdmin };

console.log('--- auth.middleware.js loaded successfully ---'); // Debugging log
