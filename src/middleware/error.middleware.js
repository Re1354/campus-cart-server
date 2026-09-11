/**
 * Global error handling middleware.
 * Must be the LAST middleware registered in index.js (4 args signature).
 *
 * - Operational errors (AppError instances) → send their statusCode + message to client
 * - Programming errors / unexpected crashes → log full error, send generic 500
 */
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  // Default to 500 if no statusCode set
  err.statusCode = err.statusCode || 500;

  // Multer upload errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 2MB per image.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: 'Too many files. Maximum is 5 images per request.' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ message: 'Unexpected upload field or maximum 5 images exceeded.' });
    }
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }

  if (err.isOperational) {
    // Known, safe-to-expose error
    return res.status(err.statusCode).json({ message: err.message });
  }

  // Unknown error — log it server-side but hide details from client
  console.error('💥 Unexpected error:', err);
  res.status(500).json({ message: 'Something went wrong. Please try again later.' });
};

module.exports = errorHandler;
