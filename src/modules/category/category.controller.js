const catchAsync = require('../../utils/catchAsync');
const categoryService = require('./category.service');

/**
 * POST /api/admin/categories
 * Create a new category (Admin only)
 */
exports.createCategory = catchAsync(async (req, res) => {
  const { name, description, imageUrl, isActive } = req.body;
  const category = await categoryService.createCategory({
    name,
    description,
    imageUrl,
    isActive,
  });

  res.status(201).json({
    message: 'Category created successfully',
    category,
  });
});

/**
 * GET /api/categories
 * List all active categories (Public)
 */
exports.listActiveCategories = catchAsync(async (req, res) => {
  const categories = await categoryService.getAllActiveCategories();

  res.status(200).json({
    count: categories.length,
    categories,
  });
});

/**
 * GET /api/categories/:slug
 * Get single category details by slug (Public)
 */
exports.getCategoryBySlug = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const category = await categoryService.getCategoryBySlug(slug);

  res.status(200).json({
    category,
  });
});

/**
 * PATCH /api/admin/categories/:id
 * Update category details (Admin only)
 */
exports.updateCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updatedCategory = await categoryService.updateCategory(id, req.body);

  res.status(200).json({
    message: 'Category updated successfully',
    category: updatedCategory,
  });
});

/**
 * DELETE /api/admin/categories/:id
 * Soft delete category by setting isActive: false (Admin only)
 */
exports.deleteCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const deletedCategory = await categoryService.softDeleteCategory(id);

  res.status(200).json({
    message: 'Category deactivated successfully',
    category: deletedCategory,
  });
});
