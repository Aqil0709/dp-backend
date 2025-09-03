const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
    },
    category: {
        type: String,
        required: [true, 'Product category is required'],
        trim: true,
    },
    price: {
        type: Number,
        required: [true, 'Product price is required'],
        min: [0, 'Price cannot be negative'],
    },
    originalPrice: {
        type: Number,
        min: [0, 'Original price cannot be negative'],
    },
    description: {
        type: String,
        required: [true, 'Product description is required'],
    },
    images: {
        type: [
            {
                url: {
                    type: String,
                    required: [true, 'Image URL is required'],
                },
                public_id: {
                    type: String,
                    required: [true, 'Cloudinary public_id is required'],
                },
            },
        ],
        required: [true, 'At least one product image is required.'],
        validate: {
            validator: function(arr) {
                return arr.length > 0;
            },
            message: 'At least one product image is required.',
        },
    },
    quantity: {
        type: Number,
        required: [true, 'Stock quantity is required'],
        min: [0, 'Quantity cannot be negative'],
        default: 0,
    },
    isSpecial: {
        type: Boolean,
        default: false,
    },
    isTrending: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
