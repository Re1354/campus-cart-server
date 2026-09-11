const catchAsync = require('../../utils/catchAsync');
const statsService = require('./stats.service');

/**
 * GET /api/admin/stats
 * Platform overview statistics
 */
exports.getStats = catchAsync(async (req, res) => {
  const stats = await statsService.getPlatformStats();
  res.status(200).json({ stats });
});
