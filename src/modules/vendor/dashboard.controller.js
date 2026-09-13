const catchAsync = require('../../utils/catchAsync');
const dashboardService = require('./dashboard.service');

/**
 * GET /api/vendor/dashboard/stats
 * Aggregated analytics for the authenticated vendor
 */
exports.getStats = catchAsync(async (req, res) => {
  const vendorId = req.user.id || req.user.userId;
  const stats = await dashboardService.getDashboardStats(vendorId);

  res.status(200).json({
    stats,
  });
});

/**
 * GET /api/vendor/dashboard/recent-orders?limit=5
 * Recent orders containing authenticated vendor's products
 */
exports.getRecentOrders = catchAsync(async (req, res) => {
  const vendorId = req.user.id || req.user.userId;
  const { limit } = req.query;
  const orders = await dashboardService.getRecentOrders(vendorId, limit);

  res.status(200).json({
    count: orders.length,
    orders,
  });
});

/**
 * GET /api/vendor/dashboard/revenue-chart?period=7d|30d|12m
 * Revenue time-series chart data for authenticated vendor
 */
exports.getRevenueChart = catchAsync(async (req, res) => {
  const vendorId = req.user.id || req.user.userId;
  const { period } = req.query;
  const chartData = await dashboardService.getRevenueChart(vendorId, period);

  res.status(200).json({
    period: (period || '30d').toLowerCase(),
    data: chartData,
  });
});

/**
 * GET /api/vendor/profile
 * Get authenticated vendor's user and profile details
 */
exports.getProfile = catchAsync(async (req, res) => {
  const vendorId = req.user.id || req.user.userId;
  const profileData = await dashboardService.getVendorProfile(vendorId);

  res.status(200).json(profileData);
});

/**
 * PATCH /api/vendor/profile
 * Update authenticated vendor's businessName and description
 */
exports.updateProfile = catchAsync(async (req, res) => {
  const vendorId = req.user.id || req.user.userId;
  const updatedProfile = await dashboardService.updateVendorProfile(vendorId, req.body);

  res.status(200).json({
    message: 'Vendor profile updated successfully',
    vendorProfile: updatedProfile,
  });
});

/**
 * GET /api/vendor/earnings
 * Detailed earnings, commission deductions, and net payout
 */
exports.getEarnings = catchAsync(async (req, res) => {
  const vendorId = req.user.id || req.user.userId;
  const earningsData = await dashboardService.getVendorEarnings(vendorId);

  res.status(200).json(earningsData);
});
