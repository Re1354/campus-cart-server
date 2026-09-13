const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');
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
  const categories = await categoryService.getAllActiveCategories(req.query);

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
 * GET /api/admin/categories
 * List all categories with product count (Admin only)
 */
exports.listAllCategoriesForAdmin = catchAsync(async (req, res) => {
  const categories = await categoryService.getAllCategoriesForAdmin();

  res.status(200).json({
    count: categories.length,
    categories,
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
 * PATCH /api/admin/categories/:id/toggle
 * Toggle category active/inactive status (Admin only)
 */
exports.toggleCategoryStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updatedCategory = await categoryService.toggleCategoryStatus(id);

  res.status(200).json({
    message: `Category is now ${updatedCategory.isActive ? 'active' : 'inactive'}`,
    category: updatedCategory,
  });
});

/**
 * DELETE /api/admin/categories/:id
 * Permanently delete category with foreign key product safety (Admin only)
 */
exports.deleteCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const deletedCategory = await categoryService.deleteCategory(id);

  res.status(200).json({
    message: 'Category deleted successfully',
    category: deletedCategory,
  });
});

/**
 * POST /api/admin/categories/upload-image
 * Upload single category image to Cloudinary (Admin only)
 */
exports.uploadCategoryImage = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(
      new AppError(
        'No image uploaded. Please provide an image file under field name "image".',
        400
      )
    );
  }

  const imageUrl = req.file.path || req.file.secure_url || req.file.url;

  res.status(200).json({
    message: 'Category image uploaded successfully',
    imageUrl,
    url: imageUrl,
  });
});


