const express = require('express');
const router = express.Router();
const productController = require('./products.controller');
const authMiddleware = require('../middleware/auth.middleware');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// --- Configure Multer for file uploads ---
// The destination folder for uploads
const uploadDir = path.join(__dirname, '../../public/uploads');

// Configure disk storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Use a unique name to prevent conflicts
        crypto.randomBytes(16, (err, hash) => {
            if (err) return cb(err);
            const filename = `${hash.toString('hex')}${path.extname(file.originalname)}`;
            cb(null, filename);
        });
    }
});

// Create the upload middleware instance
const upload = multer({ storage: storage });

// --- PUBLIC ROUTES ---
router.get('/', productController.getAllProducts);
router.get('/:productId', productController.getProductById);
router.get('/:productId/reviews', productController.getProductReviews);

// --- ADMIN ONLY ROUTES ---
// FIX: Changed upload.single() to upload.array() and matched the field name
// The frontend uses the field name 'productImages', so the middleware must match it.
router.post(
    '/add',
    authMiddleware.authenticate,
    authMiddleware.authorizeAdmin,
    upload.array('productImages', 4), // FIX: Changed field name and added max count
    productController.addProduct
);

// FIX: Changed upload.single() to upload.array() and matched the field name
// The frontend uses the field name 'productImages', so the middleware must match it.
router.put(
    '/update/:productId',
    authMiddleware.authenticate,
    authMiddleware.authorizeAdmin,
    upload.array('productImages', 4), // FIX: Changed field name and added max count
    productController.updateProduct
);

router.put(
    '/status/:productId',
    authMiddleware.authenticate,
    authMiddleware.authorizeAdmin,
    productController.updateProductStatus
);

router.delete(
    '/delete/:productId',
    authMiddleware.authenticate,
    authMiddleware.authorizeAdmin,
    productController.deleteProduct
);

// --- USER ROUTES (Authenticated) ---
router.post(
    '/review',
    authMiddleware.authenticate,
    productController.createProductReview
);

module.exports = router;
