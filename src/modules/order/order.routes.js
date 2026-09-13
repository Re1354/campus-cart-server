const express = require('express');
const router = express.Router();
const orderController = require('./order.controller');
const authenticate = require('../../middleware/authenticate');
const requireRole = require('../../middleware/requireRole');
const requireApprovedVendor = require('../../middleware/requireApprovedVendor');

// ─── Public Tracking Route (No auth strictly required) ───────────────────
// GET /api/orders/track/:id -> Public tracking summary for any order
router.get('/orders/track/:id', orderController.trackOrderPublic);

// ─── Buyer Routes (Protected: authenticate + requireRole(['USER'])) ───────────

// POST /api/orders -> Place order from items in user's Cart
router.post(
  '/orders',
  authenticate,
  requireRole(['USER']),
  orderController.createOrder
);

// GET /api/orders -> List current user's order history
router.get(
  '/orders',
  authenticate,
  requireRole(['USER']),
  orderController.getBuyerOrders
);

// GET /api/orders/:id -> Get specific order detail for buyer
router.get(
  '/orders/:id',
  authenticate,
  requireRole(['USER']),
  orderController.getBuyerOrderById
);

// PATCH /api/orders/:id/cancel -> Cancel order if status is PENDING
router.patch(
  '/orders/:id/cancel',
  authenticate,
  requireRole(['USER']),
  orderController.cancelBuyerOrder
);

// POST /api/orders/:id/confirm-delivery -> Confirm order delivery
router.post(
  '/orders/:id/confirm-delivery',
  authenticate,
  orderController.confirmDelivery
);

// ─── Vendor Routes (Protected: authenticate + requireApprovedVendor) ──────────

// GET /api/vendor/orders -> List orders containing products belonging to logged-in vendor
router.get(
  '/vendor/orders',
  authenticate,
  requireApprovedVendor,
  orderController.getVendorOrders
);

// GET /api/vendor/orders/:id -> Get order detail showing ONLY items belonging to logged-in vendor
router.get(
  '/vendor/orders/:id',
  authenticate,
  requireApprovedVendor,
  orderController.getVendorOrderById
);

// PATCH /api/vendor/orders/:id/status -> Vendor updates order status to CONFIRMED, PROCESSING, SHIPPED
router.patch(
  '/vendor/orders/:id/status',
  authenticate,
  requireApprovedVendor,
  orderController.updateVendorOrderStatus
);

// ─── Admin Routes (Protected: authenticate + requireRole(['ADMIN'])) ──────────

// GET /api/admin/orders -> List ALL platform orders with pagination
router.get(
  '/admin/orders',
  authenticate,
  requireRole(['ADMIN']),
  orderController.getAdminOrders
);

// GET /api/admin/orders/:id -> Full order detail with vendor breakdown per item
router.get(
  '/admin/orders/:id',
  authenticate,
  requireRole(['ADMIN']),
  orderController.getAdminOrderById
);

// PATCH /api/admin/orders/:id/status -> Update overall Order status
router.patch(
  '/admin/orders/:id/status',
  authenticate,
  requireRole(['ADMIN']),
  orderController.updateOrderStatus
);

module.exports = router;
