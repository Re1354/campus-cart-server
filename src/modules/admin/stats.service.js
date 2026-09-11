const prisma = require('../../utils/prisma');

/**
 * Platform Overview & Dashboard Stats
 * Returns:
 * - totalUsers: Count of buyers (role: USER)
 * - totalVendors: Count of approved vendors
 * - pendingVendors: Count of vendors awaiting approval
 * - totalOrders: Total platform orders
 * - totalRevenue: Sum of totalAmount for DELIVERED orders across the platform
 * - recentOrders: Last 5 platform orders
 * - recentVendorApplications: Last 5 PENDING vendors
 */
const getPlatformStats = async () => {
  const [
    totalUsers,
    totalVendors,
    pendingVendors,
    totalOrders,
    deliveredOrders,
    recentOrdersRaw,
    recentVendorApplicationsRaw,
  ] = await Promise.all([
    // 1. Total buyers
    prisma.user.count({
      where: { role: 'USER' },
    }),
    // 2. Approved vendors
    prisma.vendorProfile.count({
      where: { status: 'APPROVED' },
    }),
    // 3. Pending vendors
    prisma.vendorProfile.count({
      where: { status: 'PENDING' },
    }),
    // 4. Total orders
    prisma.order.count(),
    // 5. Total revenue from DELIVERED orders
    prisma.order.findMany({
      where: { status: 'DELIVERED' },
      select: { totalAmount: true },
    }),
    // 6. Recent 5 platform orders
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    // 7. Recent 5 pending vendor applications
    prisma.user.findMany({
      where: {
        role: 'VENDOR',
        vendorProfile: {
          is: { status: 'PENDING' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        vendorProfile: {
          select: {
            id: true,
            businessName: true,
            description: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const totalRevenue = Number(
    deliveredOrders
      .reduce((sum, o) => sum + Number(o.totalAmount), 0)
      .toFixed(2)
  );

  const recentOrders = recentOrdersRaw.map((o) => ({
    id: o.id,
    status: o.status,
    totalAmount: Number(o.totalAmount),
    shippingAddress: o.shippingAddress,
    buyer: o.user,
    createdAt: o.createdAt,
  }));

  const recentVendorApplications = recentVendorApplicationsRaw.map((v) => ({
    id: v.id,
    name: v.name,
    email: v.email,
    businessName: v.vendorProfile?.businessName || v.name,
    description: v.vendorProfile?.description || null,
    appliedAt: v.vendorProfile?.createdAt || v.createdAt,
  }));

  return {
    totalUsers,
    totalVendors,
    pendingVendors,
    totalOrders,
    totalRevenue,
    recentOrders,
    recentVendorApplications,
  };
};

module.exports = {
  getPlatformStats,
};
