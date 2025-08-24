// backend/api/stock/stock.controller.js
const { Product, Stock } = require('../../models/productAndStock.model'); // Your Mongoose models

// Function to get all stock levels
const getAllStock = async (req, res) => {
    try {
        // FIX: Use Mongoose to find and populate stock data
        const stock = await Stock.find().populate('product').sort({ product_name: 1 });
        res.status(200).json(stock);
    } catch (error) {
        console.error('Error fetching all stock:', error);
        res.status(500).json({ message: 'Server error while fetching stock.' });
    }
};

// Function to add new stock for a product
const addStock = async (req, res) => {
    const { productId, quantity } = req.body;
    const token = req.headers.authorization.split(' ')[1]; // Assuming you have a way to get the token
    // The product name is now fetched from the database to ensure data integrity
        
    if (!productId || quantity === undefined || quantity < 0) {
        return res.status(400).json({ message: 'Product ID and a valid quantity are required.' });
    }

    try {
        // FIX: Find the product using Mongoose
        const productToAddStockFor = await Product.findById(productId);
        if (!productToAddStockFor) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        // FIX: Use Mongoose to check if a stock entry for this product already exists
        const existingStock = await Stock.findOne({ product: productId });
        
        if (existingStock) {
            return res.status(409).json({ message: 'Stock for this product already exists. Use PUT to update it.' });
        }
        
        // FIX: Use Mongoose to create a new stock entry
        const newStock = new Stock({
            product: productId,
            quantity: quantity,
            product_name: productToAddStockFor.name
        });
        await newStock.save();

        // FIX: Update the product's quantity in the products collection
        await Product.findByIdAndUpdate(productId, { quantity: quantity });
        
        res.status(201).json({ message: 'Stock added successfully!' });

    } catch (error) {
        console.error('Error adding stock:', error);
        res.status(500).json({ message: 'Server error while adding stock.' });
    }
};


// Function to update stock for a specific product
const updateProductStock = async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || quantity < 0) {
        return res.status(400).json({ message: 'Invalid quantity provided. Quantity must be a non-negative number.' });
    }

    try {
        // FIX: Use Mongoose to find and update the stock entry
        const updatedStock = await Stock.findOneAndUpdate(
            { product: productId },
            { quantity: quantity },
            { new: true } // Return the updated document
        );

        if (!updatedStock) {
            return res.status(404).json({ message: 'Stock for this product not found. Use POST to add new stock.' });
        }
        // FIX: Update the product's quantity in the products collection
        await Product.findByIdAndUpdate(productId, { quantity: quantity });
        res.status(200).json({ message: 'Stock updated successfully.' });

    } catch (error) {
        console.error('Error updating product stock:', error);
        res.status(500).json({ message: 'Server error while updating stock.' });
    }
};

module.exports = {
    getAllStock,
    addStock,
    updateProductStock
};
