const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');

/**
 * Ensures the authenticated user is a VENDOR with an APPROVED VendorProfile.
 * Must be used AFTER `authenticate` (requires req.user to be set).
 *
 * Usage:
 *   router.post('/vendor/products', authenticate, requireApprovedVendor, handler);
 */
const requireApprovedVendor = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'VENDOR') {
      return next(new AppError('Access denied — vendor account required', 403));
    }

    const profile = await prisma.vendorProfile.findUnique({
      where: { userId: req.user.userId },
    });

    if (!profile || profile.status !== 'APPROVED') {
      return next(
        new AppError('Access denied — vendor account is not yet approved', 403)
      );
    }

    // Attach vendor profile to request for use in downstream handlers
    req.vendorProfile = profile;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = requireApprovedVendor;
