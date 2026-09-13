const catchAsync = require('../../utils/catchAsync');
const userService = require('./user.service');

/**
 * GET /api/admin/users
 * List all buyers with pagination
 */
exports.listUsers = catchAsync(async (req, res) => {
  const result = await userService.listUsers(req.query);
  res.status(200).json(result);
});

/**
 * GET /api/admin/users/:id
 * Get buyer detail and complete order history
 */
exports.getUserDetail = catchAsync(async (req, res) => {
  const { id } = req.params;
  const user = await userService.getUserDetail(id);
  res.status(200).json({ user });
});

/**
 * DELETE /api/admin/users/:id
 * Soft delete user (sets isActive = false)
 */
exports.softDeleteUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  const user = await userService.softDeleteUser(id);
  res.status(200).json({
    message: 'User account deactivated successfully',
    user,
  });
});

/**
 * PATCH /api/admin/users/:id/status
 * Toggle user active status (activate / deactivate)
 */
exports.toggleUserStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;
  const user = await userService.toggleUserStatus(id, isActive);
  res.status(200).json({
    message: `User account ${user.isActive ? 'activated' : 'deactivated'} successfully`,
    user,
  });
});
