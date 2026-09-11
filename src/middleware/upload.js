const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const AppError = require('../utils/AppError');

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'campus_cart/products',
    allowed_formats: ['jpeg', 'png', 'jpg', 'webp'],
  },
});

// File filter restricting formats to jpeg, png, jpg, webp
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Invalid file type. Only JPEG, PNG, JPG, and WEBP images are allowed.',
        400
      ),
      false
    );
  }
};

// Multer upload middleware with 2MB size limit and maximum 5 files
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB per image
    files: 5,                  // max 5 files per request
  },
});

module.exports = upload;
