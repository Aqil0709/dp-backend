// backend/controllers/productController.js
const Product = require('../../models/product.model'); // <-- IMPORT the new Product model
const fs = require('fs');
const path = require('path');

// --- Helper functions for local file deletion (No changes needed here) ---
const getFilenameFromUrl = (url) => {
    try {
        return path.basename(new URL(url).pathname);
    } catch (error) {
        console.warn('Could not parse URL to get filename:', url);
        return null;
    }
};

const deleteFile = (filename) => {
    if (!filename) return;
    const filePath = path.join(__dirname, '../public/uploads', filename);
    fs.unlink(filePath, (err) => {
        if (err && err.code !== 'ENOENT') {
            console.error(`Error deleting file ${filePath}:`, err);
        } else if (!err) {
            console.log(`Successfully deleted file: ${filePath}`);
        }
    });
};

// --- PUBLIC ---
const getAllProducts = async (req, res) => {
    try {
        // MONGO: Simply find all products. The quantity is now part of the document.
        const products = await Product.find({}).sort({ createdAt: -1 });
        res.status(200).json(products);
    } catch (error) {
        console.error('Get all products error:', error);
        res.status(500).json({ message: 'Server error while fetching products.' });
    }
};

const getProductById = async (req, res) => {
    try {
        // MONGO: Find a single product by its ID.
        const product = await Product.findById(req.params.productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        res.status(200).json(product);
    } catch (error) {
        console.error('Get product by ID error:', error);
        res.status(500).json({ message: 'Server error while fetching product.' });
    }
};

// --- ADMIN ONLY ---
const addProduct = async (req, res) => {
    const { name, category, price, originalPrice, description, quantity } = req.body;

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'Product images are required.' });
    }

    const imageURLs = req.files.map(file =>
        `${req.protocol}://${req.get('host')}/public/uploads/${file.filename}`
    );

    try {
        // MONGO: Create a new product with all data in a single operation.
        const newProduct = await Product.create({
            name,
            category,
            price,
            originalPrice,
            description,
            quantity,
            images: imageURLs,
        });
        res.status(201).json(newProduct);
    } catch (error) {
        console.error('Add product error:', error);
        // If DB insertion fails, clean up the uploaded files.
        imageURLs.forEach(url => deleteFile(getFilenameFromUrl(url)));
        res.status(500).json({ message: 'Server error while adding product.' });
    }
};

const updateProduct = async (req, res) => {
    const { productId } = req.params;
    const { name, category, price, originalPrice, description, quantity, currentImageUrlsToRetain } = req.body;

    try {
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        let finalImageURLs = product.images;
        const oldImageURLs = [...product.images]; // Copy old URLs for comparison

        // Logic for handling image updates and deleting old files from disk
        if (req.files && req.files.length > 0) {
            // New files uploaded, replace all old ones
            finalImageURLs = req.files.map(file => `${req.protocol}://${req.get('host')}/public/uploads/${file.filename}`);
            oldImageURLs.forEach(url => deleteFile(getFilenameFromUrl(url)));
        } else if (currentImageUrlsToRetain) {
            // No new files, but some existing images might have been removed
            const retainedUrls = JSON.parse(currentImageUrlsToRetain);
            finalImageURLs = retainedUrls;
            const urlsToDelete = oldImageURLs.filter(url => !retainedUrls.includes(url));
            urlsToDelete.forEach(url => deleteFile(getFilenameFromUrl(url)));
        }

        if (finalImageURLs.length === 0) {
            return res.status(400).json({ message: 'At least one product image is required.' });
        }
        
        // MONGO: Update the fields of the found product document
        product.name = name;
        product.category = category;
        product.price = price;
        product.originalPrice = originalPrice;
        product.description = description;
        product.quantity = quantity;
        product.images = finalImageURLs;

        // MONGO: Save the updated document
        const updatedProduct = await product.save();
        res.status(200).json(updatedProduct);

    } catch (error) {
        console.error('Update product error:', error);
        // If DB update fails, clean up any newly uploaded files
        if (req.files) {
            req.files.forEach(file => deleteFile(file.filename));
        }
        res.status(500).json({ message: 'Server error while updating product.' });
    }
};

const deleteProduct = async (req, res) => {
    const { productId } = req.params;

    try {
        // MONGO: Find the product to get its image URLs before deleting
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        // Delete image files from the server's storage
        product.images.forEach(url => deleteFile(getFilenameFromUrl(url)));

        // MONGO: Delete the product document from the database
        await Product.findByIdAndDelete(productId);
        
        res.status(200).json({ message: 'Product deleted successfully.' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ message: 'Server error while deleting product.' });
    }
};

module.exports = {
    getAllProducts,
    getProductById,
    addProduct,
    updateProduct,
    deleteProduct,
};