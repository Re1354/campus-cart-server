const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');
const productService = require('./product.service');

// ─── Vendor Controllers ───────────────────────────────────────────────────────

/**
 * POST /api/vendor/products/upload-images
 * Upload up to 5 product images to Cloudinary
 */
exports.uploadImages = catchAsync(async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next(
      new AppError(
        'No images uploaded. Please provide up to 5 images under field name "images".',
        400
      )
    );
  }

  const urls = req.files.map((file) => file.path || file.secure_url || file.url);

  res.status(200).json({
    message: 'Images uploaded successfully',
    urls,
  });
});

/**
 * POST /api/vendor/products
 * Create a new product for the authenticated vendor
 */
exports.createProduct = catchAsync(async (req, res) => {
  const vendorId = req.user.id;
  const product = await productService.createProduct(vendorId, req.body);

  res.status(201).json({
    message: 'Product created successfully',
    product,
  });
});

/**
 * GET /api/vendor/products
 * List all products belonging to the authenticated vendor
 */
exports.getVendorProducts = catchAsync(async (req, res) => {
  const vendorId = req.user.id;
  const products = await productService.getVendorProducts(vendorId);

  res.status(200).json({
    count: products.length,
    products,
  });
});

/**
 * GET /api/vendor/products/:id
 * Get specific product detail owned by the authenticated vendor
 */
exports.getVendorProductById = catchAsync(async (req, res) => {
  const vendorId = req.user.id;
  const { id } = req.params;
  const product = await productService.getVendorProductById(vendorId, id);

  res.status(200).json({
    product,
  });
});

/**
 * PATCH /api/vendor/products/:id
 * Update vendor's own product
 */
exports.updateVendorProduct = catchAsync(async (req, res) => {
  const vendorId = req.user.id;
  const { id } = req.params;
  const product = await productService.updateVendorProduct(vendorId, id, req.body);

  res.status(200).json({
    message: 'Product updated successfully',
    product,
  });
});

/**
 * DELETE /api/vendor/products/:id
 * Soft delete vendor's own product (sets isActive: false)
 */
exports.deleteVendorProduct = catchAsync(async (req, res) => {
  const vendorId = req.user.id;
  const { id } = req.params;
  const product = await productService.softDeleteVendorProduct(vendorId, id);

  res.status(200).json({
    message: 'Product deactivated successfully',
    product,
  });
});

// ─── Public Controllers ───────────────────────────────────────────────────────

/**
 * GET /api/products
 * List all active products with search, category filtering, and pagination.
 * Excludes all vendor info.
 */
exports.getPublicProducts = catchAsync(async (req, res) => {
  const result = await productService.getPublicProducts(req.query);

  res.status(200).json(result);
});

/**
 * GET /api/products/:slug
 * Get single active product detail by slug.
 * Excludes all vendor info.
 */
exports.getPublicProductBySlug = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const product = await productService.getPublicProductBySlug(slug);

  res.status(200).json({
    product,
  });
});
