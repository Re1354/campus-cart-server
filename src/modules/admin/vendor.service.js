const prisma = require('../../utils/prisma');
const AppError = require('../../utils/AppError');

/**
 * List all vendors with VendorProfile (supports status filter and pagination)
 * @param {Object} queryParams - { status, page, limit }
 */
const listVendors = async (queryParams) => {
  const { status, page = 1, limit = 10 } = queryParams || {};
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const take = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * take;

  const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];
  if (status && !validStatuses.includes(status.toUpperCase())) {
    throw new AppError(
      `Invalid status filter. Allowed: ${validStatuses.join(', ')}`,
      400
    );
  }

  const where = {
    role: 'VENDOR',
    vendorProfile: {
      isNot: null,
      ...(status && {
        is: {
          status: status.toUpperCase(),
        },
      }),
    },
  };

  const [total, vendors] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mobileNumber: true,
        createdAt: true,
        vendorProfile: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
    }),
  ]);

  return {
    vendors: vendors.map((v) => ({
      id: v.id,
      name: v.name,
      email: v.email,
      isActive: v.isActive,
      mobileNumber: v.mobileNumber,
      createdAt: v.createdAt,
      profile: v.vendorProfile,
      productCount: v._count.products,
    })),
    pagination: {
      total,
      page: pageNum,
      limit: take,
      totalPages: Math.ceil(total / take),
      hasNextPage: pageNum < Math.ceil(total / take),
      hasPrevPage: pageNum > 1,
    },
  };
};

/**
 * Detailed view of vendor profile, total sales, and product count
 * @param {string} id - User ID of vendor
 */
const getVendorDetail = async (id) => {
  const vendor = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      mobileNumber: true,
      mobileVerified: true,
      createdAt: true,
      vendorProfile: true,
      _count: {
        select: {
          products: true,
        },
      },
    },
  });

  if (!vendor || vendor.role !== 'VENDOR' || !vendor.vendorProfile) {
    throw new AppError('Vendor not found', 404);
  }

  // Calculate totalSales: sum of (priceAtTime * quantity) for DELIVERED order items
  const deliveredItems = await prisma.orderItem.findMany({
    where: {
      vendorId: id,
      order: {
        status: 'DELIVERED',
      },
    },
    select: {
      priceAtTime: true,
      quantity: true,
    },
  });

  const totalSales = Number(
    deliveredItems
      .reduce((sum, item) => sum + Number(item.priceAtTime) * item.quantity, 0)
      .toFixed(2)
  );

  return {
    id: vendor.id,
    name: vendor.name,
    email: vendor.email,
    role: vendor.role,
    isActive: vendor.isActive,
    mobileNumber: vendor.mobileNumber,
    mobileVerified: vendor.mobileVerified,
    createdAt: vendor.createdAt,
    profile: vendor.vendorProfile,
    productCount: vendor._count.products,
    totalSales,
  };
};

/**
 * Set VendorProfile.status to APPROVED
 * @param {string} id - Vendor user ID
 */
const approveVendor = async (id) => {
  const profile = await prisma.vendorProfile.findUnique({
    where: { userId: id },
  });

  if (!profile) {
    throw new AppError('Vendor profile not found', 404);
  }

  return await prisma.vendorProfile.update({
    where: { userId: id },
    data: { status: 'APPROVED' },
  });
};

/**
 * Set VendorProfile.status to REJECTED with optional reason
 * @param {string} id - Vendor user ID
 * @param {string} reason
 */
const rejectVendor = async (id, reason) => {
  const profile = await prisma.vendorProfile.findUnique({
    where: { userId: id },
  });

  if (!profile) {
    throw new AppError('Vendor profile not found', 404);
  }

  const updated = await prisma.vendorProfile.update({
    where: { userId: id },
    data: {
      status: 'REJECTED',
      rejectionReason: reason ? reason.trim() : 'Application rejected by administration',
    },
  });

  return {
    vendorProfile: updated,
    reason: updated.rejectionReason,
  };
};

/**
 * Set VendorProfile.status to SUSPENDED
 * @param {string} id - Vendor user ID
 */
const suspendVendor = async (id) => {
  const profile = await prisma.vendorProfile.findUnique({
    where: { userId: id },
  });

  if (!profile) {
    throw new AppError('Vendor profile not found', 404);
  }

  return await prisma.vendorProfile.update({
    where: { userId: id },
    data: { status: 'SUSPENDED' },
  });
};

/**
 * Update vendor commission rate percentage
 * @param {string} id - Vendor user ID
 * @param {number|string} commissionRate
 */
const updateCommission = async (id, commissionRate) => {
  const rate = parseFloat(commissionRate);

  if (isNaN(rate) || rate < 0 || rate > 100) {
    throw new AppError(
      'Commission rate must be a valid number between 0 and 100',
      400
    );
  }

  const profile = await prisma.vendorProfile.findUnique({
    where: { userId: id },
  });

  if (!profile) {
    throw new AppError('Vendor profile not found', 404);
  }

  return await prisma.vendorProfile.update({
    where: { userId: id },
    data: { commissionRate: rate },
  });
};

module.exports = {
  listVendors,
  getVendorDetail,
  approveVendor,
  rejectVendor,
  suspendVendor,
  updateCommission,
};
