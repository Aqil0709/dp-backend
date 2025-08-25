/*
  STEP 1: 
  This is the complete code for your `product.controller.js` file.
*/

// backend/controllers/product.controller.js
const Product = require('../../models/product.model');
const Review = require('../../models/review.model');
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
    const filePath = path.join(__dirname, '../../public/uploads', filename);
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
const addProduct = async (req, res) => {
    const { name, category, price, originalPrice, description, quantity } = req.body;

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'Product images are required.' });
    }

    const imageURLs = req.files.map(file =>
        `/public/uploads/${file.filename}`
    );

    try {
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
        const oldImageURLs = [...product.images];

        if (req.files && req.files.length > 0) {
            finalImageURLs = req.files.map(file => `/public/uploads/${file.filename}`);
            oldImageURLs.forEach(url => deleteFile(getFilenameFromUrl(url)));
        } else if (currentImageUrlsToRetain) {
            const retainedUrls = JSON.parse(currentImageUrlsToRetain);
            finalImageURLs = retainedUrls;
            const urlsToDelete = oldImageURLs.filter(url => !retainedUrls.includes(url));
            urlsToDelete.forEach(url => deleteFile(getFilenameFromUrl(url)));
        }

        if (finalImageURLs.length === 0) {
            return res.status(400).json({ message: 'At least one product image is required.' });
        }
        
        product.name = name;
        product.category = category;
        product.price = price;
        product.originalPrice = originalPrice;
        product.description = description;
        product.quantity = quantity;
        product.images = finalImageURLs;

        const updatedProduct = await product.save();
        res.status(200).json(updatedProduct);

    } catch (error) {
        console.error('Update product error:', error);
        if (req.files) {
            req.files.forEach(file => deleteFile(file.filename));
        }
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

        const review = await Review.create({
            rating,
            comment,
            product: productId,
            user: userId,
        });

        const reviews = await Review.find({ product: productId });
        const numOfReviews = reviews.length;
        const totalRating = reviews.reduce((acc, item) => item.rating + acc, 0);
        
        product.ratings = totalRating / numOfReviews;
        product.numOfReviews = numOfReviews;
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
        
        // --- FIX: Populate the user's name from the User collection ---
        // This tells the database to find the user associated with each review
        // and include their 'name' in the response.
        const reviews = await Review.find({ product: productId })
            .populate('user', 'name') // This is the line that fetches the user's name
            .sort({ createdAt: -1 }); // This sorts to show the newest reviews first
        
        res.status(200).json(reviews);
    } catch (error) {
        console.error('Error fetching product reviews:', error);
        res.status(500).json({ message: 'Server error while fetching reviews.' });
    }
};

module.exports = {
    getAllProducts,
    getProductById,
    addProduct,
    updateProduct,
    deleteProduct,
    createProductReview,
    getProductReviews,
};
