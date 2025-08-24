// backend/api/stock/stock.controller.js
const db = require('../../config/db'); // Your database connection

// Function to get all stock levels
const getAllStock = async (req, res) => {
    try {
        // Fetch all stock data, now including product_name
        const [stock] = await db.query(`
            SELECT
                s.product_id,
                s.product_name,
                s.quantity,
                s.last_updated
            FROM stock s
            ORDER BY s.product_id ASC
        `);
        res.status(200).json(stock);
    } catch (error) {
        console.error('Error fetching all stock:', error);
        res.status(500).json({ message: 'Server error while fetching stock.' });
    }
};

// NEW: Function to add new stock for a product
const addStock = async (req, res) => {
    // --- DEBUG LOGS START ---
    console.log("Backend: addStock received request body:", req.body);
    // --- DEBUG LOGS END ---

    const { productId, productName, quantity } = req.body;

    if (!productId || !productName || quantity === undefined || quantity < 0) {
        // --- DEBUG LOGS START ---
        console.log("Backend: addStock validation failed.");
        console.log("  productId:", productId, " (Type:", typeof productId, ")");
        console.log("  productName:", productName, " (Type:", typeof productName, ")");
        console.log("  quantity:", quantity, " (Type:", typeof quantity, ")");
        // --- DEBUG LOGS END ---
        return res.status(400).json({ message: 'Product ID, product name, and a valid quantity are required.' });
    }

    try {
        // First, check if the product_id actually exists in the products table
        const [productExists] = await db.query('SELECT id FROM products WHERE id = ?', [productId]);
        if (productExists.length === 0) {
            return res.status(400).json({ message: 'Product ID does not exist in the products table. Please add the product first.' });
        }

        // Check if a stock entry for this product already exists
        const [existingStock] = await db.query('SELECT * FROM stock WHERE product_id = ?', [productId]);

        if (existingStock.length > 0) {
            // If stock already exists, it's an update operation, not an add.
            return res.status(409).json({ message: 'Stock for this product already exists. Use PUT to update it.' });
        }

        // If stock entry doesn't exist, create it
        await db.query('INSERT INTO stock (product_id, product_name, quantity) VALUES (?, ?, ?)',
            [productId, productName, quantity]);
        res.status(201).json({ message: 'Stock added successfully!' });

    } catch (error) {
        console.error('Error adding stock:', error);
        res.status(500).json({ message: 'Server error while adding stock.' });
    }
};


// Function to update stock for a specific product (now only handles updates)
const updateProductStock = async (req, res) => {
    const { productId } = req.params; // From URL parameter
    const { quantity, productName } = req.body; // productName is now optional for updates

    if (quantity === undefined || quantity < 0) {
        return res.status(400).json({ message: 'Invalid quantity provided. Quantity must be a non-negative number.' });
    }

    try {
        // Check if the product exists in the stock table
        const [existingStock] = await db.query('SELECT * FROM stock WHERE product_id = ?', [productId]);

        if (existingStock.length === 0) {
            // If stock entry doesn't exist, it's an add operation, not an update.
            return res.status(404).json({ message: 'Stock for this product not found. Use POST to add new stock.' });
        } else {
            // If stock entry exists, update it
            // Update product_name as well, if provided, otherwise keep existing
            const updateFields = ['quantity = ?', 'last_updated = CURRENT_TIMESTAMP'];
            const updateValues = [quantity];

            if (productName !== undefined) { // Only update product_name if it's explicitly provided
                updateFields.push('product_name = ?');
                updateValues.push(productName);
            }
            updateValues.push(productId); // Add productId for the WHERE clause

            await db.query(`UPDATE stock SET ${updateFields.join(', ')} WHERE product_id = ?`, updateValues);
            res.status(200).json({ message: 'Stock updated successfully.' });
        }
    } catch (error) {
        console.error('Error updating product stock:', error);
        res.status(500).json({ message: 'Server error while updating stock.' });
    }
};

module.exports = {
    getAllStock,
    addStock, // Export the new addStock function
    updateProductStock
};
