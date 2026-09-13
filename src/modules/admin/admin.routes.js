const express = require('express');
const router = express.Router();

const authenticate = require('../../middleware/authenticate');
const requireRole = require('../../middleware/requireRole');

const vendorController = require('./vendor.controller');
const userController = require('./user.controller');
const statsController = require('./stats.controller');
const productController = require('./product.controller');

// ─── Guard all Admin routes with authenticate + requireRole(['ADMIN']) ────────
router.use(authenticate, requireRole(['ADMIN']));

// ─── a. Vendor Account Approvals & Management ─────────────────────────────────
router.get('/vendors', vendorController.listVendors);
router.get('/vendors/:id', vendorController.getVendorDetail);
router.patch('/vendors/:id/approve', vendorController.approveVendor);
router.patch('/vendors/:id/reject', vendorController.rejectVendor);
router.patch('/vendors/:id/suspend', vendorController.suspendVendor);
router.patch('/vendors/:id/commission', vendorController.updateCommission);

// ─── b. Buyer Account Management ──────────────────────────────────────────────
router.get('/users', userController.listUsers);
router.get('/users/:id', userController.getUserDetail);
router.patch('/users/:id/status', userController.toggleUserStatus);
router.delete('/users/:id', userController.softDeleteUser);

// ─── c. Platform Overview & Dashboard Stats ───────────────────────────────────
router.get('/stats', statsController.getStats);

// ─── d. Platform Product Oversight ────────────────────────────────────────────
router.get('/products', productController.listProducts);
router.patch('/products/:id/toggle', productController.toggleProductStatus);
router.delete('/products/:id', productController.deleteProduct);

module.exports = router;
