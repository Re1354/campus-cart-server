const express = require('express');
const router = express.Router();
const categoryController = require('./category.controller');
const authenticate = require('../../middleware/authenticate');
const requireRole = require('../../middleware/requireRole');

// ─── Admin Routes (Protected: ADMIN only) ─────────────────────────────────────

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

// DELETE /api/admin/categories/:id -> Soft delete category (isActive: false)
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
