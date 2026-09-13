const prisma = require('../../utils/prisma');
const AppError = require('../../utils/AppError');

/**
 * Format a Date object to YYYY-MM-DD in UTC/local consistent string.
 * @param {Date} d
 * @returns {string}
 */
const formatDate = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format a Date object to YYYY-MM-01 (first day of the month).
 * @param {Date} d
 * @returns {string}
 */
const formatMonth = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

/**
 * GET /api/vendor/dashboard/stats
 * Aggregated analytics for the vendor:
 * - totalRevenue: Sum of (priceAtTime * quantity) for DELIVERED order items belonging to this vendor
 * - pendingRevenue: Sum of revenue for PENDING / CONFIRMED / PROCESSING / SHIPPED order items
 * - totalOrders: Count of unique orders containing vendor's products
 * - totalProducts: Count of vendor's active products
 * - totalProductsSold: Total sum of product units sold across completed/non-cancelled orders
 *
 * @param {string} vendorId
 */
const getDashboardStats = async (vendorId) => {
  // 1. Delivered revenue (Realized revenue)
  const deliveredItems = await prisma.orderItem.findMany({
    where: {
      vendorId,
      order: {
        status: 'DELIVERED',
      },
    },
    select: {
      priceAtTime: true,
      quantity: true,
    },
  });

  const totalRevenue = Number(
    deliveredItems
      .reduce((sum, item) => sum + Number(item.priceAtTime) * item.quantity, 0)
      .toFixed(2)
  );

  // 2. Pending revenue (Orders in pipeline: PENDING, CONFIRMED, PROCESSING, SHIPPED)
  const pendingItems = await prisma.orderItem.findMany({
    where: {
      vendorId,
      order: {
        status: {
          in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'],
        },
      },
    },
    select: {
      priceAtTime: true,
      quantity: true,
    },
  });

  const pendingRevenue = Number(
    pendingItems
      .reduce((sum, item) => sum + Number(item.priceAtTime) * item.quantity, 0)
      .toFixed(2)
  );

  // 3. Total unique orders containing vendor's products
  const totalOrders = await prisma.order.count({
    where: {
      items: {
        some: { vendorId },
      },
    },
  });

  // 4. Total active products listed by this vendor
  const totalProducts = await prisma.product.count({
    where: {
      vendorId,
      isActive: true,
    },
  });

  // 5. Total units sold across non-cancelled orders
  const soldItems = await prisma.orderItem.findMany({
    where: {
      vendorId,
      order: {
        status: {
          not: 'CANCELLED',
        },
      },
    },
    select: {
      quantity: true,
    },
  });

  const totalProductsSold = soldItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return {
    totalRevenue,
    pendingRevenue,
    totalOrders,
    totalProducts,
    totalProductsSold,
  };
};

/**
 * GET /api/vendor/dashboard/recent-orders?limit=5
 * Returns the last N orders containing vendor's products with summarized item count and amount.
 *
 * @param {string} vendorId
 * @param {number|string} limit
 */
const getRecentOrders = async (vendorId, limit = 5) => {
  const take = Math.max(1, Math.min(50, parseInt(limit, 10) || 5));

  const orders = await prisma.order.findMany({
    where: {
      items: {
        some: { vendorId },
      },
    },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      items: {
        where: { vendorId }, // STRICT: Only this vendor's items
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              images: true,
            },
          },
        },
      },
    },
  });

  return orders.map((order) => {
    const vendorItems = (order.items || []).map((item) => {
      const priceAtTime = Number(item.priceAtTime);
      const itemTotal = Number((priceAtTime * item.quantity).toFixed(2));
      return {
        id: item.id,
        productId: item.productId,
        name: item.product?.name || 'Product',
        slug: item.product?.slug || null,
        image: item.product?.images?.[0] || null,
        priceAtTime,
        quantity: item.quantity,
        itemTotal,
      };
    });

    const itemCount = vendorItems.reduce((sum, item) => sum + item.quantity, 0);
    const amount = Number(
      vendorItems.reduce((sum, item) => sum + item.itemTotal, 0).toFixed(2)
    );

    return {
      id: order.id,
      status: order.status,
      createdAt: order.createdAt,
      customer: {
        name: order.user?.name || 'Customer',
        email: order.user?.email || '',
      },
      shippingAddress: order.shippingAddress,
      itemCount,
      amount,
      items: vendorItems,
    };
  });
};

/**
 * GET /api/vendor/dashboard/revenue-chart?period=7d|30d|12m
 * Returns revenue grouped by date (or month) for rendering time-series charts.
 * Response format: [{ date: "YYYY-MM-DD", revenue: 1250.00 }, ...]
 *
 * @param {string} vendorId
 * @param {string} period - '7d', '30d', or '12m'
 */
const getRevenueChart = async (vendorId, period = '30d') => {
  const normalizedPeriod = (period || '30d').toLowerCase();
  const validPeriods = ['7d', '30d', '12m'];

  if (!validPeriods.includes(normalizedPeriod)) {
    throw new AppError(
      `Invalid period "${period}". Allowed values: 7d, 30d, 12m`,
      400
    );
  }

  const now = new Date();
  let startDate;
  const buckets = new Map();

  if (normalizedPeriod === '7d') {
    // Last 7 days inclusive of today
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      buckets.set(formatDate(d), 0);
    }
  } else if (normalizedPeriod === '30d') {
    // Last 30 days inclusive of today
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
    for (let i = 0; i < 30; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      buckets.set(formatDate(d), 0);
    }
  } else if (normalizedPeriod === '12m') {
    // Last 12 months inclusive of current month
    startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);
    for (let i = 0; i < 12; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      buckets.set(formatMonth(d), 0);
    }
  }

  // Fetch DELIVERED order items within the target date window
  const items = await prisma.orderItem.findMany({
    where: {
      vendorId,
      order: {
        status: 'DELIVERED',
        createdAt: {
          gte: startDate,
        },
      },
    },
    select: {
      priceAtTime: true,
      quantity: true,
      order: {
        select: {
          createdAt: true,
        },
      },
    },
  });

  // Aggregate revenue into date buckets
  for (const item of items) {
    const itemTotal = Number(item.priceAtTime) * item.quantity;
    const itemDate = new Date(item.order.createdAt);
    const key = normalizedPeriod === '12m' ? formatMonth(itemDate) : formatDate(itemDate);

    if (buckets.has(key)) {
      buckets.set(key, buckets.get(key) + itemTotal);
    }
  }

  // Format into response array [{ date, revenue }]
  return Array.from(buckets.entries()).map(([date, revenue]) => ({
    date,
    revenue: Number(revenue.toFixed(2)),
  }));
};

/**
 * GET /api/vendor/profile
 * Returns current logged-in vendor's User and VendorProfile details.
 *
 * @param {string} vendorId
 */
const getVendorProfile = async (vendorId) => {
  const user = await prisma.user.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      mobileNumber: true,
      mobileVerified: true,
      createdAt: true,
      vendorProfile: {
        select: {
          id: true,
          businessName: true,
          description: true,
          status: true,
          commissionRate: true,
          payoutDetails: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError('Vendor user not found', 404);
  }

  if (!user.vendorProfile) {
    throw new AppError('Vendor profile not found', 404);
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mobileNumber: user.mobileNumber,
      mobileVerified: user.mobileVerified,
      createdAt: user.createdAt,
    },
    vendorProfile: user.vendorProfile,
  };
};

/**
 * PATCH /api/vendor/profile
 * Body: { businessName, description }
 * Vendors CANNOT modify admin-only fields like status or commissionRate.
 *
 * @param {string} vendorId
 * @param {Object} data - { businessName, description }
 */
const updateVendorProfile = async (vendorId, data) => {
  const { businessName, description } = data || {};

  const existingProfile = await prisma.vendorProfile.findUnique({
    where: { userId: vendorId },
  });

  if (!existingProfile) {
    throw new AppError('Vendor profile not found', 404);
  }

  const updateData = {};

  if (businessName !== undefined) {
    if (typeof businessName !== 'string' || !businessName.trim()) {
      throw new AppError('Business name cannot be empty', 400);
    }
    updateData.businessName = businessName.trim();
  }

  if (description !== undefined) {
    updateData.description = typeof description === 'string' ? description.trim() : null;
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError('No valid profile fields provided for update', 400);
  }

  const updatedProfile = await prisma.vendorProfile.update({
    where: { userId: vendorId },
    data: updateData,
    select: {
      id: true,
      userId: true,
      businessName: true,
      description: true,
      status: true,
      commissionRate: true,
      payoutDetails: true,
      createdAt: true,
    },
  });

  return updatedProfile;
};

/**
 * GET /api/vendor/earnings
 * Detailed breakdown of vendor earnings, commission deductions, and net payout.
 * @param {string} vendorId
 */
const getVendorEarnings = async (vendorId) => {
  const profile = await prisma.vendorProfile.findUnique({
    where: { userId: vendorId },
    select: {
      businessName: true,
      commissionRate: true,
      payoutDetails: true,
    },
  });

  if (!profile) {
    throw new AppError('Vendor profile not found', 404);
  }

  const commissionRate = profile.commissionRate || 10.0;

  // Realized earnings from DELIVERED order items
  const deliveredItems = await prisma.orderItem.findMany({
    where: {
      vendorId,
      order: {
        status: 'DELIVERED',
      },
    },
    include: {
      product: {
        select: {
          name: true,
          slug: true,
        },
      },
      order: {
        select: {
          id: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      order: {
        createdAt: 'desc',
      },
    },
  });

  const grossEarnings = Number(
    deliveredItems
      .reduce((sum, item) => sum + Number(item.priceAtTime) * item.quantity, 0)
      .toFixed(2)
  );

  const platformFee = Number(((grossEarnings * commissionRate) / 100).toFixed(2));
  const netPayout = Number((grossEarnings - platformFee).toFixed(2));

  // Pending earnings from pipeline orders
  const pendingItems = await prisma.orderItem.findMany({
    where: {
      vendorId,
      order: {
        status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] },
      },
    },
    select: {
      priceAtTime: true,
      quantity: true,
    },
  });

  const grossPending = Number(
    pendingItems
      .reduce((sum, item) => sum + Number(item.priceAtTime) * item.quantity, 0)
      .toFixed(2)
  );
  const estimatedNetPending = Number(
    (grossPending * (1 - commissionRate / 100)).toFixed(2)
  );

  return {
    commissionRate,
    payoutDetails: profile.payoutDetails,
    summary: {
      grossEarnings,
      platformFee,
      netPayout,
      grossPending,
      estimatedNetPending,
      deliveredUnits: deliveredItems.reduce((sum, item) => sum + item.quantity, 0),
    },
    recentDeliveredItems: deliveredItems.slice(0, 10).map((item) => {
      const priceAtTime = Number(item.priceAtTime);
      const total = Number((priceAtTime * item.quantity).toFixed(2));
      const fee = Number(((total * commissionRate) / 100).toFixed(2));
      return {
        orderId: item.order.id,
        date: item.order.createdAt,
        productName: item.product?.name || 'Product',
        quantity: item.quantity,
        priceAtTime,
        grossTotal: total,
        platformFee: fee,
        netTotal: Number((total - fee).toFixed(2)),
      };
    }),
  };
};

module.exports = {
  getDashboardStats,
  getRecentOrders,
  getRevenueChart,
  getVendorProfile,
  updateVendorProfile,
  getVendorEarnings,
};
