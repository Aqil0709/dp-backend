/* global __app_id */
const Product = require('../../models/product.model');
const Review = require('../../models/review.model');
const fs = require('fs');
const path = require('path');
const { Types } = require('mongoose');

// --- Helper functions for local file deletion ---
const getFilenameFromUrl = (url) => {
    try {
        return path.basename(new URL(url).pathname);
    } catch (error) {
        // Fallback for relative paths like /public/uploads/filename.jpg
        if (typeof url === 'string' && url.includes('/')) {
            return url.substring(url.lastIndexOf('/') + 1);
        }
        console.warn('Could not parse URL to get filename:', url);
        return null;
    }
};

const deleteFile = (filename) => {
    if (!filename) return;
    const filePath = path.join(__dirname, '../../../public/uploads', filename);
    fs.unlink(filePath, (err) => {
        if (err && err.code !== 'ENOENT') { // Don't log error if file doesn't exist
            console.error(`Error deleting file ${filePath}:`, err);
        } else if (!err) {
            console.log(`Successfully deleted file: ${filePath}`);
        }
    });
};


// --- PUBLIC ---
const getAllProducts = async (req, res) => {
    try {
        const products = await Product.find({}).sort({ createdAt: -1 });
        res.status(200).json(products);
    } catch (error) {
        console.error('Get all products error:', error);
        res.status(500).json({ message: 'Server error while fetching products.' });
    }
};

const getProductById = async (req, res) => {
    try {
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
/**
 * Handles adding a new product with image uploads.
 * It performs robust validation and error handling for all fields.
 */
const addProduct = async (req, res) => {
    const { name, category, price, originalPrice, description, quantity, isSpecial, isTrending } = req.body;

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'Product images are required.' });
    }
    if (!name || !category || !description || !price || !quantity) {
        req.files.forEach(file => deleteFile(file.filename));
        return res.status(400).json({ message: 'Required fields are missing.' });
    }

    const parsedPrice = Number(price);
    const parsedQuantity = Number(quantity);
    const parsedOriginalPrice = originalPrice ? Number(originalPrice) : undefined;
    const isSpecialBool = isSpecial === 'true';
    const isTrendingBool = isTrending === 'true';

    if (isNaN(parsedPrice) || parsedPrice <= 0 || isNaN(parsedQuantity) || parsedQuantity < 0) {
        req.files.forEach(file => deleteFile(file.filename));
        return res.status(400).json({ message: 'Price must be a positive number and quantity must be a non-negative number.' });
    }
    if (originalPrice && isNaN(parsedOriginalPrice)) {
        req.files.forEach(file => deleteFile(file.filename));
        return res.status(400).json({ message: 'Original price must be a valid number.' });
    }

    const imageURLs = req.files.map(file => `/public/uploads/${file.filename}`);

    try {
        const newProduct = await Product.create({
            name,
            category,
            price: parsedPrice,
            originalPrice: parsedOriginalPrice,
            description,
            quantity: parsedQuantity,
            images: imageURLs,
            isSpecial: isSpecialBool,
            isTrending: isTrendingBool,
        });
        res.status(201).json(newProduct);
    } catch (error) {
        console.error('Add product error:', error);
        imageURLs.forEach(url => deleteFile(getFilenameFromUrl(url)));
        res.status(500).json({ message: 'Server error while adding product.' });
    }
};

/**
 * Handles updating an existing product.
 * It correctly handles FormData string values and image updates.
 */
const updateProduct = async (req, res) => {
    const { productId } = req.params;

    if (!Types.ObjectId.isValid(productId)) {
        if (req.files) req.files.forEach(file => deleteFile(file.filename));
        return res.status(400).json({ message: 'Invalid product ID format.' });
    }

    const {
        name, category, description, price, originalPrice, quantity,
        isSpecial, isTrending, currentImageUrlsToRetain
    } = req.body;

    const updateFields = {};
    if (name !== undefined && name !== '') updateFields.name = name;
    if (category !== undefined && category !== '') updateFields.category = category;
    if (description !== undefined && description !== '') updateFields.description = description;
    if (price !== undefined && price !== '' && !isNaN(Number(price))) updateFields.price = Number(price);
    if (originalPrice !== undefined && originalPrice !== '' && !isNaN(Number(originalPrice))) updateFields.originalPrice = Number(originalPrice);
    if (quantity !== undefined && quantity !== '' && !isNaN(Number(quantity))) updateFields.quantity = Number(quantity);
    if (isSpecial !== undefined) updateFields.isSpecial = isSpecial === 'true';
    if (isTrending !== undefined) updateFields.isTrending = isTrending === 'true';

    let oldImageUrlsToDelete = [];

    try {
        const product = await Product.findById(productId);
        if (!product) {
            if (req.files) req.files.forEach(file => deleteFile(file.filename));
            return res.status(404).json({ message: 'Product not found.' });
        }

        let newImageUrls;
        if (req.files && req.files.length > 0) {
            newImageUrls = req.files.map(file => `/public/uploads/${file.filename}`);
            oldImageUrlsToDelete = product.images;
        } else if (currentImageUrlsToRetain) {
            const retainedUrls = JSON.parse(currentImageUrlsToRetain);
            newImageUrls = retainedUrls;
            oldImageUrlsToDelete = product.images.filter(url => !retainedUrls.includes(url));
        } else {
            newImageUrls = product.images;
            oldImageUrlsToDelete = [];
        }

        if (!newImageUrls || newImageUrls.length === 0) {
            if (req.files) req.files.forEach(file => deleteFile(file.filename));
            return res.status(400).json({ message: 'At least one product image is required.' });
        }

        updateFields.images = newImageUrls;

        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: 'Product not found after update attempt.' });
        }

        oldImageUrlsToDelete.forEach(url => deleteFile(getFilenameFromUrl(url)));
        res.status(200).json(updatedProduct);

    } catch (error) {
        console.error('Update product error:', error);
        if (req.files) req.files.forEach(file => deleteFile(file.filename));
        res.status(500).json({ message: 'Server error while updating product.' });
    }
};

const deleteProduct = async (req, res) => {
    const { productId } = req.params;
    try {
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        product.images.forEach(url => deleteFile(getFilenameFromUrl(url)));
        await Product.findByIdAndDelete(productId);
        res.status(200).json({ message: 'Product deleted successfully.' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ message: 'Server error while deleting product.' });
    }
};

// --- NEW: Controller to update stock for a product ---
const updateProductStock = async (req, res) => {
    const { productId } = req.params;
    const { quantityChange } = req.body;

    if (!quantityChange || isNaN(Number(quantityChange))) {
        return res.status(400).json({ message: 'Valid quantityChange is required.' });
    }

    try {
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        // Use $inc to atomically update the quantity
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { $inc: { quantity: Number(quantityChange) } },
            { new: true, runValidators: true }
        );
        
        // Ensure stock doesn't go below zero
        if (updatedProduct.quantity < 0) {
            // Revert the change if it results in negative stock
            await Product.findByIdAndUpdate(productId, { $inc: { quantity: -Number(quantityChange) } });
            return res.status(400).json({ message: 'Stock quantity cannot be negative.' });
        }
        
        res.status(200).json({ message: 'Stock updated successfully.', product: updatedProduct });

    } catch (error) {
        console.error('Error updating product stock:', error);
        res.status(500).json({ message: 'Server error while updating stock.' });
    }
};


// --- REVIEW FUNCTIONALITY ---
const createProductReview = async (req, res) => {
    const { rating, comment, productId } = req.body;

    if (!req.user || !req.user._id) {
        return res.status(401).json({ message: 'Authentication error, user not found.' });
    }
    const userId = req.user._id;

    try {
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found." });
        }
        const alreadyReviewed = await Review.findOne({ product: productId, user: userId });
        if (alreadyReviewed) {
            return res.status(400).json({ message: 'You have already submitted a review for this product.' });
        }

        const review = await Review.create({ rating, comment, product: productId, user: userId });

        const reviews = await Review.find({ product: productId });
        product.ratings = reviews.reduce((acc, item) => item.rating + acc, 0) / reviews.length;
        product.numOfReviews = reviews.length;
        await product.save({ validateBeforeSave: false });

        res.status(201).json({ success: true, review });

    } catch (error) {
        console.error('Create product review error:', error);
        res.status(500).json({ message: 'Server error while submitting review.' });
    }
};

const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        const reviews = await Review.find({ product: productId }).populate('user', 'name').sort({ createdAt: -1 });
        res.status(200).json(reviews);
    } catch (error) {
        console.error('Error fetching product reviews:', error);
        res.status(500).json({ message: 'Server error while fetching reviews.' });
    }
};

// --- Controller to update a product's special/trending status ---
const updateProductStatus = async (req, res) => {
    const { productId } = req.params;
    const { isSpecial, isTrending } = req.body;

    if (isSpecial === undefined && isTrending === undefined) {
        return res.status(400).json({ message: 'At least one status field (isSpecial or isTrending) is required.' });
    }

    try {
        const updatedFields = {};
        if (isSpecial !== undefined) updatedFields.isSpecial = isSpecial;
        if (isTrending !== undefined) updatedFields.isTrending = isTrending;

        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { $set: updatedFields },
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        res.status(200).json({ message: 'Product status updated successfully.', product: updatedProduct });

    } catch (error) {
        console.error('Error updating product status:', error);
        res.status(500).json({ message: 'Server error while updating product status.' });
    }
};

module.exports = {
    getAllProducts,
    getProductById,
    addProduct,
    updateProduct,
    deleteProduct,
    updateProductStock, // NEW: Export the stock update function
    createProductReview,
    getProductReviews,
    updateProductStatus
};
