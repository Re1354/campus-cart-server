const express = require('express');
const router = express.Router();
const productController = require('./product.controller');
const authenticate = require('../../middleware/authenticate');
const requireApprovedVendor = require('../../middleware/requireApprovedVendor');
const upload = require('../../middleware/upload');

// ─── Vendor Routes (Protected: authenticate + requireApprovedVendor) ──────────

// POST /api/vendor/products/upload-images -> Upload up to 5 product images
router.post(
  '/vendor/products/upload-images',
  authenticate,
  requireApprovedVendor,
  upload.array('images', 5),
  productController.uploadImages
);

// POST /api/vendor/products -> Create product for logged-in vendor
router.post(
  '/vendor/products',
  authenticate,
  requireApprovedVendor,
  productController.createProduct
);

// GET /api/vendor/products -> List logged-in vendor's own products
router.get(
  '/vendor/products',
  authenticate,
  requireApprovedVendor,
  productController.getVendorProducts
);

// GET /api/vendor/products/:id -> Get specific product detail (own product only)
router.get(
  '/vendor/products/:id',
  authenticate,
  requireApprovedVendor,
  productController.getVendorProductById
);

// PATCH /api/vendor/products/:id -> Update vendor's own product
router.patch(
  '/vendor/products/:id',
  authenticate,
  requireApprovedVendor,
  productController.updateVendorProduct
);

// DELETE /api/vendor/products/:id -> Soft delete vendor's own product
router.delete(
  '/vendor/products/:id',
  authenticate,
  requireApprovedVendor,
  productController.deleteVendorProduct
);

// ─── Public Routes (No Auth) ──────────────────────────────────────────────────

// GET /api/products -> List all active products (query params: category, search, page, limit)
router.get('/products', productController.getPublicProducts);

// GET /api/products/top-selling -> List top-selling products by order count
router.get('/products/top-selling', productController.getTopSellingProducts);

// GET /api/products/homepage-feed -> Consolidated fast homepage feed
router.get('/products/homepage-feed', productController.getHomepageFeed);

// GET /api/products/:slug -> Get single active product detail by slug
router.get('/products/:slug', productController.getPublicProductBySlug);

module.exports = router;
