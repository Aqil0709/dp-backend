const Product = require('../../models/product.model');
const Review = require('../../models/review.model');
const fs = require('fs');
const path = require('path');
const { Types } = require('mongoose');

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
    const filePath = path.join(__dirname, '../../../public/uploads', filename);
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
/**
 * Handles adding a new product with image uploads.
 * It performs robust validation and error handling for all fields.
 */
const addProduct = async (req, res) => {
    const { name, category, price, originalPrice, description, quantity, isSpecial, isTrending } = req.body;

    // A. Check for required fields and files
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'Product images are required.' });
    }
    if (!name || !category || !description || !price || !quantity) {
        // If required fields are missing, delete the uploaded files before responding
        req.files.forEach(file => deleteFile(file.filename));
        return res.status(400).json({ message: 'Required fields are missing.' });
    }

    // B. Parse numerical and boolean values from the FormData string data
    const parsedPrice = Number(price);
    const parsedQuantity = Number(quantity);
    const parsedOriginalPrice = originalPrice ? Number(originalPrice) : undefined;
    const isSpecialBool = isSpecial === 'true';
    const isTrendingBool = isTrending === 'true';

    // C. Validate parsed numerical values
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
        // On database error, delete the uploaded files to clean up
        imageURLs.forEach(url => deleteFile(getFilenameFromUrl(url)));
        res.status(500).json({ message: 'Server error while adding product.' });
    }
};

/**
 * Handles updating an existing product.
 * It correctly handles FormData string values and image updates.
 */
const updateProduct = async (req, res) => {
    // --- DIAGNOSTIC STEP: Log the incoming data to see what the server is receiving ---
    console.log('Received PUT request for product update:');
    console.log('req.params:', req.params);
    console.log('req.body:', req.body);
    console.log('req.files:', req.files);
    // ----------------------------------------------------------------------------------

    const { productId } = req.params;
    
    // Validate productId format early
    if (!Types.ObjectId.isValid(productId)) {
        // Delete any newly uploaded files before returning
        if (req.files) {
            req.files.forEach(file => deleteFile(file.filename));
        }
        return res.status(400).json({ message: 'Invalid product ID format.' });
    }

    // Explicitly destructure fields from the request body (all will be strings from FormData)
    const { 
        name, 
        category, 
        description, 
        price, 
        originalPrice, 
        quantity, 
        isSpecial, 
        isTrending,
        currentImageUrlsToRetain
    } = req.body;

    // Build the update object with careful type casting and validation
    const updateFields = {};

    if (name !== undefined && name !== '') updateFields.name = name;
    if (category !== undefined && category !== '') updateFields.category = category;
    if (description !== undefined && description !== '') updateFields.description = description;

    // --- FIX: Add check for empty string before number conversion ---
    if (price !== undefined && price !== '' && !isNaN(Number(price))) updateFields.price = Number(price);
    if (originalPrice !== undefined && originalPrice !== '' && !isNaN(Number(originalPrice))) updateFields.originalPrice = Number(originalPrice);
    if (quantity !== undefined && quantity !== '' && !isNaN(Number(quantity))) updateFields.quantity = Number(quantity);

    // Safely parse boolean fields from strings
    if (isSpecial !== undefined) updateFields.isSpecial = isSpecial === 'true';
    if (isTrending !== undefined) updateFields.isTrending = isTrending === 'true';

    let oldImageUrlsToDelete = [];

    try {
        let newImageUrls;
        const product = await Product.findById(productId);

        if (!product) {
            // If product is not found, delete any new files that were uploaded
            if (req.files) {
                req.files.forEach(file => deleteFile(file.filename));
            }
            return res.status(404).json({ message: 'Product not found.' });
        }

        if (req.files && req.files.length > 0) {
            // Case 1: New images were uploaded.
            newImageUrls = req.files.map(file => `/public/uploads/${file.filename}`);
            oldImageUrlsToDelete = product.images; // Mark all old images for deletion
        } else {
            // Case 2: No new images.
            if (currentImageUrlsToRetain) {
                // The front end sent a list of URLs to keep.
                const retainedUrls = JSON.parse(currentImageUrlsToRetain);
                newImageUrls = retainedUrls;
                // Identify images to delete by finding what's in the old array but not the new retained array
                oldImageUrlsToDelete = product.images.filter(url => !retainedUrls.includes(url));
            } else {
                // This means no new images and no retained old ones.
                // It's a valid case if the product has no images left.
                newImageUrls = product.images;
                oldImageUrlsToDelete = [];
            }
        }
        
        // Final check to ensure at least one image remains if it was a new product
        if (!newImageUrls || newImageUrls.length === 0) {
            if (req.files) {
                req.files.forEach(file => deleteFile(file.filename));
            }
            return res.status(400).json({ message: 'At least one product image is required.' });
        }
        
        // Update the images field in the update object
        updateFields.images = newImageUrls;
        
        // Use findByIdAndUpdate to perform a single, atomic update operation
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { $set: updateFields },
            { new: true, runValidators: true, useFindAndModify: false } // Options to return the new doc and run validators
        );

        if (!updatedProduct) {
             // This check is a safeguard
             return res.status(404).json({ message: 'Product not found after update attempt.' });
        }

        // Delete old files *only after* the database update is successful
        oldImageUrlsToDelete.forEach(url => deleteFile(getFilenameFromUrl(url)));
        
        res.status(200).json(updatedProduct);

    } catch (error) {
        console.error('Update product error:', error);
        // On any error, delete newly uploaded files to clean up
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
        
        const reviews = await Review.find({ product: productId })
            .populate('user', 'name') 
            .sort({ createdAt: -1 }); 
        
        res.status(200).json(reviews);
    } catch (error) {
        console.error('Error fetching product reviews:', error);
        res.status(500).json({ message: 'Server error while fetching reviews.' });
    }
};

// --- NEW: Controller to update a product's special/trending status ---
const updateProductStatus = async (req, res) => {
    const { productId } = req.params;
    const { isSpecial, isTrending } = req.body;

    if (isSpecial === undefined && isTrending === undefined) {
        return res.status(400).json({ message: 'At least one status field (isSpecial or isTrending) is required.' });
    }

    try {
        const updatedFields = {};
        if (isSpecial !== undefined) {
            updatedFields.isSpecial = isSpecial;
        }
        if (isTrending !== undefined) {
            updatedFields.isTrending = isTrending;
        }

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
    createProductReview,
    getProductReviews,
    updateProductStatus
};
