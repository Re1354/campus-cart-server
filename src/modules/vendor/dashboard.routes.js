const express = require('express');
const router = express.Router();
const dashboardController = require('./dashboard.controller');
const authenticate = require('../../middleware/authenticate');
const requireApprovedVendor = require('../../middleware/requireApprovedVendor');

// All dashboard and profile routes require an authenticated user with an APPROVED VendorProfile
router.use('/vendor', authenticate, requireApprovedVendor);

// ─── Analytics Routes ─────────────────────────────────────────────────────────

// GET /api/vendor/dashboard/stats -> Aggregated stats
router.get('/vendor/dashboard/stats', dashboardController.getStats);

// GET /api/vendor/earnings -> Detailed earnings and commission breakdown
router.get('/vendor/earnings', dashboardController.getEarnings);

// GET /api/vendor/dashboard/recent-orders?limit=5 -> Recent orders
router.get('/vendor/dashboard/recent-orders', dashboardController.getRecentOrders);

// GET /api/vendor/dashboard/revenue-chart?period=7d|30d|12m -> Chart time series
router.get('/vendor/dashboard/revenue-chart', dashboardController.getRevenueChart);

// ─── Profile Routes ───────────────────────────────────────────────────────────

// GET /api/vendor/profile -> Current logged-in vendor details
router.get('/vendor/profile', dashboardController.getProfile);

// PATCH /api/vendor/profile -> Update businessName, description
router.patch('/vendor/profile', dashboardController.updateProfile);

module.exports = router;
