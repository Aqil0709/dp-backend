const Cart = require('../../models/cart.model');
const mongoose = require('mongoose');

/**
 * @description Helper function to format the cart data into the structure 
 * the frontend expects. The frontend needs a simple array of items.
 * @param {object} cart - The full cart object from Mongoose.
 * @returns {Array} - An array of cart items.
 */
const formatCart = (cart) => {
    if (!cart || !cart.items) return [];
    // The frontend expects an array of objects, each containing the product details and quantity.
    // The .populate() method in the main functions will have already nested the product data.
    return cart.items.map(item => ({
        product: item.product,
        quantity: item.quantity,
    }));
};

/**
 * @description Fetches a user's cart and populates the product details for each item.
 */
const getCart = async (req, res) => {
    try {
        // Find the cart for the given user and populate the 'product' field in each cart item.
        const cart = await Cart.findOne({ user: req.params.userId }).populate('items.product');
        if (!cart) {
            // If the user doesn't have a cart yet, return an empty array. This is expected.
            return res.status(200).json([]);
        }
        res.status(200).json(formatCart(cart));
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ message: 'Server error while fetching cart.' });
    }
};

/**
 * @description Adds a product to the cart. If the product is already in the cart, 
 * it increments the quantity. If there's no cart, it creates one.
 */
const addToCart = async (req, res) => {
    const { userId } = req.params;
    const { id: productId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid product ID.' });
    }

    try {
        // Find the user's cart, or create a new one if it doesn't exist.
        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
        }

        // Check if the product already exists in the cart.
        const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

        if (itemIndex > -1) {
            // If it exists, increment the quantity.
            cart.items[itemIndex].quantity += 1;
        } else {
            // If it's a new product, add it to the items array.
            cart.items.push({ product: productId, quantity: 1 });
        }

        await cart.save();
        // Populate the product details before sending the response.
        await cart.populate('items.product');
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
        // If quantity is 0 or less, it should be removed. We can call the remove function.
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
            await cart.populate('items.product');
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
 * @description Removes a product from the user's cart. This is the direct fix for your issue.
 */
const removeCartItem = async (req, res) => {
    const { userId, productId } = req.params;

    try {
        // Find the user's cart and update it by "pulling" the item from the items array.
        const cart = await Cart.findOneAndUpdate(
            { user: userId },
            // Use the $pull operator to remove any item from the 'items' array
            // where the 'product' field matches the productId.
            { $pull: { items: { product: productId } } },
            // { new: true } ensures the updated cart is returned.
            { new: true }
        ).populate('items.product');

        if (!cart) {
            return res.status(404).json({ message: "Cart not found." });
        }

        res.status(200).json(formatCart(cart));
    } catch (error) {
        console.error('Remove cart item error:', error);
        res.status(500).json({ message: 'Server error while removing cart item.' });
    }
};

module.exports = {
    getCart,
    addToCart,
    updateCartItem,
    removeCartItem,
};
