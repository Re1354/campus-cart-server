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

// Multer upload middleware with 2MB size limit and maximum 5 files for products
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB per image
    files: 5,                  // max 5 files per request
  },
});

// Category-specific Cloudinary storage
const categoryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'campus_cart/categories',
    allowed_formats: ['jpeg', 'png', 'jpg', 'webp'],
  },
});

// Multer upload middleware for category banners/thumbnails (up to 5MB, single image)
const uploadCategory = multer({
  storage: categoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for categories
    files: 1,
  },
});

upload.category = uploadCategory;

module.exports = upload;

