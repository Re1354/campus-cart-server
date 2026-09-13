const express = require('express');
const router = express.Router();
const categoryController = require('./category.controller');
const authenticate = require('../../middleware/authenticate');
const requireRole = require('../../middleware/requireRole');
const upload = require('../../middleware/upload');

// ─── Admin Routes (Protected: ADMIN only) ─────────────────────────────────────

// POST /api/admin/categories/upload-image -> Upload category image to Cloudinary
router.post(
  '/admin/categories/upload-image',
  authenticate,
  requireRole(['ADMIN']),
  upload.category.single('image'),
  categoryController.uploadCategoryImage
);

// GET /api/admin/categories -> List all categories with product count & status
router.get(
  '/admin/categories',
  authenticate,
  requireRole(['ADMIN']),
  categoryController.listAllCategoriesForAdmin
);

// POST /api/admin/categories -> Create category
router.post(
  '/admin/categories',
  authenticate,
  requireRole(['ADMIN']),
  categoryController.createCategory
);

// PATCH /api/admin/categories/:id -> Update category details
router.patch(
  '/admin/categories/:id',
  authenticate,
  requireRole(['ADMIN']),
  categoryController.updateCategory
);

// PATCH /api/admin/categories/:id/toggle -> Toggle active/inactive status
router.patch(
  '/admin/categories/:id/toggle',
  authenticate,
  requireRole(['ADMIN']),
  categoryController.toggleCategoryStatus
);

// DELETE /api/admin/categories/:id -> Delete category (safe permanent delete)
router.delete(
  '/admin/categories/:id',
  authenticate,
  requireRole(['ADMIN']),
  categoryController.deleteCategory
);

// ─── Public Routes (No Auth) ──────────────────────────────────────────────────

// GET /api/categories -> List all active categories
router.get('/categories', categoryController.listActiveCategories);

// GET /api/categories/:slug -> Get single category by slug
router.get('/categories/:slug', categoryController.getCategoryBySlug);

module.exports = router;
