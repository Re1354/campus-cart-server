const prisma = require('../../utils/prisma');
const AppError = require('../../utils/AppError');

/**
 * List all buyers (role: USER) with pagination and order counts
 * @param {Object} queryParams - { page, limit }
 */
const listUsers = async (queryParams) => {
  const { page = 1, limit = 10 } = queryParams || {};
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const take = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * take;

  const where = {
    role: 'USER',
  };

  const [total, users] = await Promise.all([
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
        mobileVerified: true,
        createdAt: true,
        _count: {
          select: {
            orders: true,
          },
        },
      },
    }),
  ]);

  return {
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      mobileNumber: u.mobileNumber,
      mobileVerified: u.mobileVerified,
      createdAt: u.createdAt,
      orderCount: u._count.orders,
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
 * Buyer detail with their complete order history
 * @param {string} id - Buyer user ID
 */
const getUserDetail = async (id) => {
  const user = await prisma.user.findUnique({
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
      orders: {
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
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
      },
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return {
    ...user,
    orders: user.orders.map((o) => ({
      id: o.id,
      status: o.status,
      totalAmount: Number(o.totalAmount),
      shippingAddress: o.shippingAddress,
      createdAt: o.createdAt,
      itemCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
      items: o.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        name: i.product?.name || 'Product',
        slug: i.product?.slug || null,
        image: i.product?.images?.[0] || null,
        quantity: i.quantity,
        priceAtTime: Number(i.priceAtTime),
      })),
    })),
  };
};

/**
 * Soft delete user (set User.isActive = false)
 * @param {string} id - User ID
 */
const softDeleteUser = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { isActive: false },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      mobileNumber: true,
      mobileVerified: true,
      createdAt: true,
    },
  });

  return updatedUser;
};

module.exports = {
  listUsers,
  getUserDetail,
  softDeleteUser,
};
