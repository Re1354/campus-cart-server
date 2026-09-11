const catchAsync = require('../../utils/catchAsync');
const vendorService = require('./vendor.service');

/**
 * GET /api/admin/vendors
 * List all vendors with VendorProfile and optional status filter
 */
exports.listVendors = catchAsync(async (req, res) => {
  const result = await vendorService.listVendors(req.query);
  res.status(200).json(result);
});

/**
 * GET /api/admin/vendors/:id
 * Detailed view of vendor profile, total sales, and product count
 */
exports.getVendorDetail = catchAsync(async (req, res) => {
  const { id } = req.params;
  const vendor = await vendorService.getVendorDetail(id);
  res.status(200).json({ vendor });
});

/**
 * PATCH /api/admin/vendors/:id/approve
 * Set VendorProfile.status to APPROVED
 */
exports.approveVendor = catchAsync(async (req, res) => {
  const { id } = req.params;
  const profile = await vendorService.approveVendor(id);
  res.status(200).json({
    message: 'Vendor approved successfully',
    vendorProfile: profile,
  });
});

/**
 * PATCH /api/admin/vendors/:id/reject
 * Set VendorProfile.status to REJECTED with optional reason
 */
exports.rejectVendor = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const result = await vendorService.rejectVendor(id, reason);
  res.status(200).json({
    message: 'Vendor application rejected',
    ...result,
  });
});

/**
 * PATCH /api/admin/vendors/:id/suspend
 * Set VendorProfile.status to SUSPENDED
 */
exports.suspendVendor = catchAsync(async (req, res) => {
  const { id } = req.params;
  const profile = await vendorService.suspendVendor(id);
  res.status(200).json({
    message: 'Vendor suspended successfully',
    vendorProfile: profile,
  });
});

/**
 * PATCH /api/admin/vendors/:id/commission
 * Update vendor commission rate percentage
 */
exports.updateCommission = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { commissionRate } = req.body;
  const profile = await vendorService.updateCommission(id, commissionRate);
  res.status(200).json({
    message: 'Vendor commission rate updated successfully',
    vendorProfile: profile,
  });
});
