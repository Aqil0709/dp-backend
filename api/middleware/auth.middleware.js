const jwt = require('jsonwebtoken');

console.log('--- Loading auth.middleware.js ---');

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
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET); 
        console.log("Auth Middleware: Token decoded successfully. Decoded Payload:", decodedToken);

        // --- FIX ---
        // The decoded token payload uses 'userId', not 'id'. This line is now corrected.
        req.user = { _id: decodedToken.userId, role: decodedToken.role }; 
        console.log("Auth Middleware: req.user set to:", req.user);

        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        console.error("Auth Middleware: Authentication error:", error.message); 
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Invalid or expired token.' });
        }
        return res.status(500).json({ message: 'Authentication failed due to a server error.' });
    }
};

// Middleware to authorize only admin users
const authorizeAdmin = (req, res, next) => {
    // This middleware assumes 'authenticate' has already run and attached req.user
    console.log("Auth Middleware: Authorize Admin check. req.user:", req.user);
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: You are not authorized to perform this action.' });
    }
    next(); // User is an admin, proceed
};

module.exports = { authenticate, authorizeAdmin };

console.log('--- auth.middleware.js loaded successfully ---');
