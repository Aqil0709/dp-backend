const Cart = require('../../models/cart.model');
const mongoose = require('mongoose');

/**
 * @description Helper function to format the cart data.
 */
const formatCart = (cart) => {
    if (!cart || !cart.items) return [];
    return cart.items.map(item => ({
        product: item.product,
        quantity: item.quantity,
    }));
};

/**
 * @description A reusable function to get cart details for a user.
 * This is the missing function that your admin controller needs.
 */
const fetchUserCartDetails = async (userId) => {
    // Validate the userId to prevent Mongoose casting errors
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID format.');
    }

    const cart = await Cart.findOne({ user: userId }).populate({
        path: 'items.product',
        model: 'Product' // Explicitly specify the model name
    });
    
    // It's better to return the raw cart or null and let the caller decide what to do
    return cart;
};


// --- Your Existing Functions (Unchanged) ---

/**
 * @description Fetches a user's cart for API responses.
 */
const getCart = async (req, res) => {
    try {
        const cart = await fetchUserCartDetails(req.params.userId);
        if (!cart) {
            return res.status(200).json([]);
        }
        res.status(200).json(formatCart(cart));
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ message: 'Server error while fetching cart.' });
    }
};

/**
 * @description Adds a product to the cart.
 */
const addToCart = async (req, res) => {
    const { userId } = req.params;
    const { id: productId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid product ID.' });
    }

    try {
        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
        }

        const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

        if (itemIndex > -1) {
            cart.items[itemIndex].quantity += 1;
        } else {
            cart.items.push({ product: productId, quantity: 1 });
        }

        await cart.save();
        await cart.populate({
            path: 'items.product',
            model: 'Product'
        });
        res.status(200).json(formatCart(cart));
    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ message: 'Server error while adding to cart.' });
    }
};

/**
 * @description Updates the quantity of a specific item in the cart.
 */
const updateCartItem = async (req, res) => {
    const { userId, productId } = req.params;
    const { quantity } = req.body;

    if (quantity <= 0) {
        return removeCartItem(req, res);
    }

    try {
        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: "Cart not found." });
        }

        const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

        if (itemIndex > -1) {
            cart.items[itemIndex].quantity = quantity;
            await cart.save();
            await cart.populate({
                path: 'items.product',
                model: 'Product'
            });
            res.status(200).json(formatCart(cart));
        } else {
            res.status(404).json({ message: "Product not in cart." });
        }
    } catch (error) {
        console.error('Update cart item error:', error);
        res.status(500).json({ message: 'Server error while updating cart item.' });
    }
};

/**
 * @description Removes a product from the user's cart.
 */
const removeCartItem = async (req, res) => {
    const { userId, productId } = req.params;

    try {
        const cart = await Cart.findOneAndUpdate(
            { user: userId },
            { $pull: { items: { product: productId } } },
            { new: true }
        ).populate({
            path: 'items.product',
            model: 'Product'
        });

        if (!cart) {
            return res.status(404).json({ message: "Cart not found." });
        }

        res.status(200).json(formatCart(cart));
    } catch (error) {
        console.error('Remove cart item error:', error);
        res.status(500).json({ message: 'Server error while removing cart item.' });
    }
};

// --- Updated Exports ---
module.exports = {
    getCart,
    addToCart,
    updateCartItem,
    removeCartItem,
    fetchUserCartDetails, // <-- Now exporting the required function
};