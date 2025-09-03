/* global __app_id */
const Product = require('../../models/product.model');
const Review = require('../../models/review.model');
const { Types } = require('mongoose');
const cloudinary = require('../../config/cloudinary');
const fs = require('fs');

// --- Helper: Delete local temp files ---
const deleteLocalFile = (filePath) => {
  if (!filePath) return;
  fs.unlink(filePath, (err) => {
    if (err) console.error("Error deleting temp file:", err);
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
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    res.status(200).json(product);
  } catch (error) {
    console.error('Get product by ID error:', error);
    res.status(500).json({ message: 'Server error while fetching product.' });
  }
};

// --- ADMIN ONLY ---
const addProduct = async (req, res) => {
  const { name, category, price, originalPrice, description, quantity, isSpecial, isTrending } = req.body;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'Product images are required.' });
  }
  if (!name || !category || !description || !price || !quantity) {
    return res.status(400).json({ message: 'Required fields are missing.' });
  }

  try {
    const parsedPrice = Number(price);
    const parsedQuantity = Number(quantity);
    const parsedOriginalPrice = originalPrice ? Number(originalPrice) : undefined;

    if (isNaN(parsedPrice) || parsedPrice <= 0 || isNaN(parsedQuantity) || parsedQuantity < 0) {
      return res.status(400).json({ message: 'Price must be positive and quantity non-negative.' });
    }

    // ✅ Upload images to Cloudinary
    const imageObjects = [];
    for (const file of req.files) {
      const result = await cloudinary.uploader.upload(file.path, { folder: 'products' });
      deleteLocalFile(file.path);
      imageObjects.push({ url: result.secure_url, public_id: result.public_id });
    }

    const newProduct = await Product.create({
      name,
      category,
      price: parsedPrice,
      originalPrice: parsedOriginalPrice,
      description,
      quantity: parsedQuantity,
      images: imageObjects,
      isSpecial: isSpecial === 'true',
      isTrending: isTrending === 'true',
    });

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ message: 'Server error while adding product.' });
  }
};

const updateProduct = async (req, res) => {
  const { productId } = req.params;

  if (!Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: 'Invalid product ID format.' });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found.' });

    const { name, category, description, price, originalPrice, quantity, isSpecial, isTrending, currentImageUrlsToRetain } = req.body;

    const updateFields = {};
    if (name) updateFields.name = name;
    if (category) updateFields.category = category;
    if (description) updateFields.description = description;
    if (price && !isNaN(Number(price))) updateFields.price = Number(price);
    if (originalPrice && !isNaN(Number(originalPrice))) updateFields.originalPrice = Number(originalPrice);
    if (quantity && !isNaN(Number(quantity))) updateFields.quantity = Number(quantity);
    if (isSpecial !== undefined) updateFields.isSpecial = isSpecial === 'true';
    if (isTrending !== undefined) updateFields.isTrending = isTrending === 'true';

    let newImages = [];

    if (req.files && req.files.length > 0) {
      // ✅ Upload new images
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, { folder: 'products' });
        deleteLocalFile(file.path);
        newImages.push({ url: result.secure_url, public_id: result.public_id });
      }
      // ✅ Delete old images from Cloudinary
      for (const img of product.images) {
        if (img.public_id) await cloudinary.uploader.destroy(img.public_id);
      }
    } else if (currentImageUrlsToRetain) {
      const retainedUrls = JSON.parse(currentImageUrlsToRetain);
      newImages = product.images.filter(img => retainedUrls.includes(img.url));
    } else {
      newImages = product.images;
    }

    if (!newImages || newImages.length === 0) {
      return res.status(400).json({ message: 'At least one product image is required.' });
    }

    updateFields.images = newImages;

    const updatedProduct = await Product.findByIdAndUpdate(productId, { $set: updateFields }, { new: true, runValidators: true });

    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Server error while updating product.' });
  }
};

const deleteProduct = async (req, res) => {
  const { productId } = req.params;
  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found.' });

    // ✅ Delete images from Cloudinary
    for (const img of product.images) {
      if (img.public_id) await cloudinary.uploader.destroy(img.public_id);
    }

    await Product.findByIdAndDelete(productId);
    res.status(200).json({ message: 'Product deleted successfully.' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Server error while deleting product.' });
  }
};

// --- STOCK ---
const updateProductStock = async (req, res) => {
  const { productId } = req.params;
  const { quantityChange } = req.body;

  if (!quantityChange || isNaN(Number(quantityChange))) {
    return res.status(400).json({ message: 'Valid quantityChange is required.' });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found.' });

    const updatedProduct = await Product.findByIdAndUpdate(productId, { $inc: { quantity: Number(quantityChange) } }, { new: true, runValidators: true });

    if (updatedProduct.quantity < 0) {
      await Product.findByIdAndUpdate(productId, { $inc: { quantity: -Number(quantityChange) } });
      return res.status(400).json({ message: 'Stock cannot be negative.' });
    }

    res.status(200).json({ message: 'Stock updated successfully.', product: updatedProduct });
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ message: 'Server error while updating stock.' });
  }
};

// --- REVIEWS ---
const createProductReview = async (req, res) => {
  const { rating, comment, productId } = req.body;

  if (!req.user || !req.user._id) return res.status(401).json({ message: 'Authentication error, user not found.' });
  const userId = req.user._id;

  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found." });

    const alreadyReviewed = await Review.findOne({ product: productId, user: userId });
    if (alreadyReviewed) return res.status(400).json({ message: 'You have already submitted a review.' });

    const review = await Review.create({ rating, comment, product: productId, user: userId });

    const reviews = await Review.find({ product: productId });
    product.ratings = reviews.reduce((acc, item) => item.rating + acc, 0) / reviews.length;
    product.numOfReviews = reviews.length;
    await product.save({ validateBeforeSave: false });

    res.status(201).json({ success: true, review });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ message: 'Server error while submitting review.' });
  }
};

const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({ product: productId }).populate('user', 'name').sort({ createdAt: -1 });
    res.status(200).json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Server error while fetching reviews.' });
  }
};

// --- SPECIAL / TRENDING ---
const updateProductStatus = async (req, res) => {
  const { productId } = req.params;
  const { isSpecial, isTrending } = req.body;

  if (isSpecial === undefined && isTrending === undefined) {
    return res.status(400).json({ message: 'At least one status field is required.' });
  }

  try {
    const updatedFields = {};
    if (isSpecial !== undefined) updatedFields.isSpecial = isSpecial;
    if (isTrending !== undefined) updatedFields.isTrending = isTrending;

    const updatedProduct = await Product.findByIdAndUpdate(productId, { $set: updatedFields }, { new: true, runValidators: true });
    if (!updatedProduct) return res.status(404).json({ message: 'Product not found.' });

    res.status(200).json({ message: 'Product status updated successfully.', product: updatedProduct });
  } catch (error) {
    console.error('Error updating product status:', error);
    res.status(500).json({ message: 'Server error while updating status.' });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct,
  updateProductStock,
  createProductReview,
  getProductReviews,
  updateProductStatus,
};
