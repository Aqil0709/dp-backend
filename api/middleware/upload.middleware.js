// backend/api/middleware/upload.middleware.js

const multer = require('multer');
const path = require('path');

// Set up storage engine for Multer to save files locally
const storage = multer.diskStorage({
    // The destination folder on your server where uploads will be stored.
    // Use path.join for robust path resolution.
    // Assuming 'api/middleware' is two levels deep from your backend root (e.g., 'backend/api/middleware')
    // then '../../public/uploads' would point to 'backend/public/uploads'
    destination: function(req, file, cb) {
        cb(null, path.join(__dirname, '../../public/uploads'));
    },
    
    // The logic for naming the uploaded files to ensure they are unique.
    filename: function(req, file, cb){
        // Creates a unique filename: timestamp.extension
        // e.g., 1678886400000.png
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// Function to check that only image files are uploaded
function checkFileType(file, cb){
    // Allowed file extensions
    const filetypes = /jpeg|jpg|png|gif/;
    // Check the file extension
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check the mime type (e.g., image/jpeg)
    const mimetype = filetypes.test(file.mimetype);

    if(mimetype && extname){
        return cb(null, true);
    } else {
        // If the file is not an image, pass an error
        // Multer will catch this error and pass it to your route handler
        cb('Error: Only image files (jpeg, jpg, png, gif) are allowed!');
    }
}

// Initialize the upload middleware with the new local storage configuration
const uploadMiddleware = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // Limit file size to 2MB (2,000,000 bytes)
    fileFilter: function(req, file, cb){
        checkFileType(file, cb);
    }
// --- CRUCIAL CHANGE HERE: Use .array() and match the frontend's field name 'productImages' ---
}).array('productImages', 4); // Expecting up to 4 files from the 'productImages' field

module.exports = uploadMiddleware;