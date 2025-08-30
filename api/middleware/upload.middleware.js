const multer = require('multer');
const path = require('path');

// Set up storage engine
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        // This path should resolve to backend/public/uploads
        cb(null, path.join(__dirname, '../../../public/uploads'));
    },
    filename: function(req, file, cb){
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// Function to filter for image files
function checkFileType(file, cb){
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if(mimetype && extname){
        return cb(null, true);
    } else {
        cb(new Error('Error: Only image files are allowed!'));
    }
}

// --- THIS IS THE FIX ---
// Export the configured Multer instance directly.
// Do NOT call .array() or .single() here. This allows the routes to decide how to use it.
const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: function(req, file, cb){
        checkFileType(file, cb);
    }
});

module.exports = upload;
