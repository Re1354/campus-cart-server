const AppError = require('../utils/AppError');

/**
 * Role-based access control middleware factory.
 * Must be used AFTER `authenticate` (requires req.user to be set).
 *
 * Usage:
 *   router.get('/admin', authenticate, requireRole(['ADMIN']), handler);
 *   router.get('/vendor', authenticate, requireRole(['VENDOR', 'ADMIN']), handler);
 *
 * @param {string[]} allowedRoles - Array of roles permitted to access the route
 * @returns {import('express').RequestHandler}
 */
const requireRole = (allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return next(
      new AppError('Access denied — insufficient permissions', 403)
    );
  }
  next();
};

module.exports = requireRole;
