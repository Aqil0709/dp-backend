const Wishlist = require('../../models/wishlist.model');

exports.addToWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOneAndUpdate(
      { user: req.user._id },
      { $addToSet: { products: req.params.productId } },
      { new: true, upsert: true }
    ).populate('products');
    res.json(wishlist);
  } catch (err) {
    res.status(500).json({ message: 'Error adding to wishlist' });
  }
};

exports.getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id }).populate('products');
    res.json(wishlist || { products: [] });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching wishlist' });
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { products: req.params.productId } },
      { new: true }
    ).populate('products');
    res.json(wishlist);
  } catch (err) {
    res.status(500).json({ message: 'Error removing from wishlist' });
  }
};
