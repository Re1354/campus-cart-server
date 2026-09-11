const catchAsync = require('../../utils/catchAsync');
const orderService = require('./order.service');

// ─── Buyer Controllers ────────────────────────────────────────────────────────

/**
 * POST /api/orders
 * Place an order from the authenticated buyer's cart
 */
exports.createOrder = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const order = await orderService.createOrder(userId, req.body);

  res.status(201).json({
    message: 'Order placed successfully',
    order,
  });
});

/**
 * GET /api/orders
 * List authenticated buyer's order history
 */
exports.getBuyerOrders = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const orders = await orderService.getBuyerOrders(userId);

  res.status(200).json({
    count: orders.length,
    orders,
  });
});

/**
 * GET /api/orders/:id
 * Get single order details for the authenticated buyer
 */
exports.getBuyerOrderById = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const order = await orderService.getBuyerOrderById(userId, id);

  res.status(200).json({
    order,
  });
});

/**
 * PATCH /api/orders/:id/cancel
 * Cancel order if status is PENDING (Buyer)
 */
exports.cancelBuyerOrder = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const order = await orderService.cancelBuyerOrder(userId, id);

  res.status(200).json({
    message: 'Order cancelled successfully',
    order,
  });
});

// ─── Vendor Controllers ───────────────────────────────────────────────────────

/**
 * GET /api/vendor/orders
 * List orders containing products belonging to the logged-in vendor
 */
exports.getVendorOrders = catchAsync(async (req, res) => {
  const vendorId = req.user.id;
  const orders = await orderService.getVendorOrders(vendorId);

  res.status(200).json({
    count: orders.length,
    orders,
  });
});

/**
 * GET /api/vendor/orders/:id
 * Get order detail showing ONLY items belonging to the logged-in vendor
 */
exports.getVendorOrderById = catchAsync(async (req, res) => {
  const vendorId = req.user.id;
  const { id } = req.params;
  const order = await orderService.getVendorOrderById(vendorId, id);

  res.status(200).json({
    order,
  });
});

// ─── Admin Controllers ────────────────────────────────────────────────────────

/**
 * GET /api/admin/orders
 * List all platform orders with pagination and optional status filter
 */
exports.getAdminOrders = catchAsync(async (req, res) => {
  const result = await orderService.getAdminOrders(req.query);

  res.status(200).json(result);
});

/**
 * GET /api/admin/orders/:id
 * Full order detail for admin with item breakdown per vendor
 */
exports.getAdminOrderById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const order = await orderService.getAdminOrderById(id);

  res.status(200).json({
    order,
  });
});

/**
 * PATCH /api/admin/orders/:id/status
 * Update overall order status (Admin only)
 */
exports.updateOrderStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const order = await orderService.updateOrderStatus(id, status);

  res.status(200).json({
    message: 'Order status updated successfully',
    order,
  });
});
