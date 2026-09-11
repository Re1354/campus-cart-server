const catchAsync = require('../../utils/catchAsync');
const productService = require('./product.service');

/**
 * GET /api/admin/products
 * List all products across all vendors with vendor details and pagination
 */
exports.listProducts = catchAsync(async (req, res) => {
  const result = await productService.listProducts(req.query);
  res.status(200).json(result);
});

/**
 * PATCH /api/admin/products/:id/toggle
 * Toggle product.isActive between true and false
 */
exports.toggleProductStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await productService.toggleProductStatus(id);
  res.status(200).json({
    message: `Product is now ${product.isActive ? 'active' : 'inactive'}`,
    product,
  });
});

/**
 * DELETE /api/admin/products/:id
 * Delete product record
 */
exports.deleteProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await productService.deleteProduct(id);
  res.status(200).json({
    message: 'Product deleted successfully',
    product: result,
  });
});
