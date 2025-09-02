const express = require('express');
const { addToWishlist, getWishlist, removeFromWishlist } = require('../controllers/wishlist.controller');
const { authenticate } = require('../middleware/auth.middleware');
const router = express.Router();

router.post('/:productId', authenticate, addToWishlist);
router.get('/', authenticate, getWishlist);
router.delete('/:productId', authenticate, removeFromWishlist);

module.exports = router;
