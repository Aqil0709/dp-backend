// backend/api/cart/cart.controller.js

const Cart = require('../models/cart.model');
const Product = require('../models/product.model');

// --- Helper function to fetch full cart details (replaces the old SQL JOIN) ---
const fetchUserCartDetails = async (userId) => {
    // Find the user's cart and use .populate() to get all product details
    const cart = await Cart.findOne({ user: userId }).populate({
        path: 'items.product',
        model: 'Product'
    });

    if (!cart) {
        return { items: [], _id: null }; // Return a default structure if no cart
    }
    return cart;
};

const getCart = async (req, res) => {
    const { userId } = req.params;
    try {
        const cart = await fetchUserCartDetails(userId);
        res.status(200).json(cart.items); // Send back just the items array
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ message: 'Server error while fetching cart.' });
    }
};

const addToCart = async (req, res) => {
    const { userId } = req.params;
    const { id: productId, quantity = 1 } = req.body; // Default quantity to 1

    try {
        // 1. Find the user's cart or create a new one if it doesn't exist
        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
        }

        // 2. Check if the product being added actually exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        
        // 3. Check if the product is already in the cart
        const itemIndex = cart.items.findIndex(item => item.product.equals(productId));

        if (itemIndex > -1) {
            // If item exists, update the quantity
            cart.items[itemIndex].quantity += quantity;
        } else {
            // If item doesn't exist, add it to the items array
            cart.items.push({ product: productId, quantity: quantity });
        }

        // 4. Save the cart to the database
        await cart.save();

        // 5. Fetch the updated, populated cart and send it back
        const updatedCart = await fetchUserCartDetails(userId);
        res.status(200).json(updatedCart.items);

    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ message: 'Server error while adding to cart.' });
    }
};

const updateCartItem = async (req, res) => {
    const { userId, productId } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || quantity < 0) {
        return res.status(400).json({ message: 'A valid quantity is required.' });
    }

    try {
        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found.' });
        }

        const itemIndex = cart.items.findIndex(item => item.product.equals(productId));

        if (itemIndex > -1) {
            if (quantity > 0) {
                // Update quantity if it's greater than 0
                cart.items[itemIndex].quantity = quantity;
            } else {
                // Remove item if quantity is 0 or less
                cart.items.splice(itemIndex, 1);
            }
            
            await cart.save();
            const updatedCart = await fetchUserCartDetails(userId);
            res.status(200).json(updatedCart.items);
        } else {
            res.status(404).json({ message: 'Item not found in cart.' });
        }
    } catch (error) {
        console.error('Update cart item error:', error);
        res.status(500).json({ message: 'Server error while updating cart item.' });
    }
};

const removeCartItem = async (req, res) => {
    const { userId, productId } = req.params;

    try {
        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found.' });
        }

        const initialLength = cart.items.length;
        // Mongoose's pull method is great for removing subdocuments
        cart.items.pull({ product: productId });

        if (cart.items.length < initialLength) {
            await cart.save();
            const updatedCart = await fetchUserCartDetails(userId);
            res.status(200).json(updatedCart.items);
        } else {
            res.status(404).json({ message: 'Item not found in cart.' });
        }
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
    fetchUserCartDetails // We export this to use in the order controller later
};