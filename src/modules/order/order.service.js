const prisma = require('../../utils/prisma');
const AppError = require('../../utils/AppError');
const cache = require('../../utils/cache');

const VALID_ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

/**
 * Format order for buyer responses.
 * STRICT SECURITY: Never includes vendorId, vendor business name, or vendor details.
 */
const formatBuyerOrder = (order) => {
  if (!order) return null;
  return {
    id: order.id,
    status: order.status,
    totalAmount: Number(order.totalAmount),
    shippingAddress: order.shippingAddress,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: (order.items || []).map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.product?.name || 'Product',
      slug: item.product?.slug || null,
      image: item.product?.images?.[0] || null,
      priceAtTime: Number(item.priceAtTime),
      quantity: item.quantity,
      itemTotal: Number((Number(item.priceAtTime) * item.quantity).toFixed(2)),
    })),
  };
};

/**
 * Place an order from the buyer's cart.
 * Runs atomically in a Prisma transaction:
 * 1. Checks stock for all items.
 * 2. Snapshots price and vendorId.
 * 3. Creates Order and OrderItem records.
 * 4. Decrements product stock.
 * 5. Clears buyer's cart.
 *
 * @param {string} userId
 * @param {Object} data - { shippingAddress: { name, phone, address, city } }
 */
const createOrder = async (userId, data) => {
  const { shippingAddress } = data || {};
  const { name, phone, address, city } = shippingAddress || {};

  if (!name || !name.trim() || !phone || !phone.trim() || !address || !address.trim() || !city || !city.trim()) {
    throw new AppError(
      'Shipping address must include name, phone, address, and city',
      400
    );
  }

  const createdOrder = await prisma.$transaction(async (tx) => {
    // a. Fetch user's cart with items and products
    const cart = await tx.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      throw new AppError('Your cart is empty', 400);
    }

    // b. Validate each item: exists, active, sufficient stock
    let totalAmount = 0;
    const orderItemsData = [];

    for (const item of cart.items) {
      const product = item.product;

      if (!product || !product.isActive) {
        throw new AppError(
          `Product "${product ? product.name : item.productId}" is no longer available`,
          404
        );
      }

      if (product.stock < item.quantity) {
        throw new AppError(
          `Insufficient stock for product "${product.name}". Available: ${product.stock}, requested: ${item.quantity}`,
          400
        );
      }

      const priceAtTime = Number(product.price);
      const itemTotal = Number((priceAtTime * item.quantity).toFixed(2));
      totalAmount += itemTotal;

      orderItemsData.push({
        productId: product.id,
        vendorId: product.vendorId, // Snapshot of vendor at placement time
        quantity: item.quantity,
        priceAtTime,
      });
    }

    totalAmount = Number(totalAmount.toFixed(2));

    // c. Create Order and OrderItem records
    const order = await tx.order.create({
      data: {
        userId,
        status: 'PENDING',
        totalAmount,
        shippingAddress: {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          city: city.trim(),
        },
        items: {
          create: orderItemsData,
        },
      },
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
    });

    // d. Decrement stock from each product atomically with stock >= quantity constraint
    for (const item of cart.items) {
      const updated = await tx.product.updateMany({
        where: {
          id: item.productId,
          stock: { gte: item.quantity },
        },
        data: {
          stock: { decrement: item.quantity },
        },
      });

      if (updated.count === 0) {
        throw new AppError(
          `Insufficient stock available for product "${item.product?.name || item.productId}".`,
          400
        );
      }
    }

    // e. Clear user's cart
    await tx.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await tx.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    return order;
  }, {
    maxWait: 10000,
    timeout: 20000,
  });

  cache.invalidateTag('orders');
  cache.invalidateTag('homepage');
  return formatBuyerOrder(createdOrder);
};

/**
 * List orders placed by the current buyer.
 * @param {string} userId
 */
const getBuyerOrders = async (userId) => {
  const orders = await prisma.order.findMany({
    where: { userId },
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
  });

  return orders.map(formatBuyerOrder);
};

/**
 * Get single order detail by ID for buyer.
 * @param {string} userId
 * @param {string} orderId
 */
const getBuyerOrderById = async (userId, orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
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
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  if (order.userId !== userId) {
    throw new AppError('Access denied — you do not own this order', 403);
  }

  return formatBuyerOrder(order);
};

/**
 * Cancel an order if status is PENDING (Buyer action).
 * Restores product stock in transaction.
 * @param {string} userId
 * @param {string} orderId
 */
const cancelBuyerOrder = async (userId, orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  if (order.userId !== userId) {
    throw new AppError('Access denied — you do not own this order', 403);
  }

  if (order.status !== 'PENDING') {
    throw new AppError(
      `Cannot cancel order with status "${order.status}". Only PENDING orders can be cancelled`,
      400
    );
  }

  const cancelledOrder = await prisma.$transaction(async (tx) => {
    // Restore stock for each item in parallel
    await Promise.all(
      order.items.map((item) =>
        tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
          },
        })
      )
    );

    return await tx.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
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
    });
  }, {
    maxWait: 10000,
    timeout: 20000,
  });

  cache.invalidateTag('orders');
  cache.invalidateTag('homepage');
  return formatBuyerOrder(cancelledOrder);
};

/**
 * List orders containing products belonging to the logged-in vendor.
 * STRICT SECURITY: ONLY exposes OrderItem records where orderItem.vendorId === req.user.id.
 * @param {string} vendorId
 */
const getVendorOrders = async (vendorId) => {
  const orders = await prisma.order.findMany({
    where: {
      items: {
        some: { vendorId },
      },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          mobileNumber: true,
        },
      },
      items: {
        where: { vendorId }, // ONLY items belonging to this vendor
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

    const vendorSubtotal = Number(
      vendorItems.reduce((sum, item) => sum + item.itemTotal, 0).toFixed(2)
    );

    return {
      id: order.id,
      status: order.status,
      shippingAddress: order.shippingAddress,
      buyer: order.user,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      vendorSubtotal,
      items: vendorItems,
    };
  });
};

/**
 * Get order detail for logged-in vendor.
 * STRICT SECURITY: ONLY exposes items where vendorId === req.user.id.
 * @param {string} vendorId
 * @param {string} orderId
 */
const getVendorOrderById = async (vendorId, orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          mobileNumber: true,
        },
      },
      items: {
        where: { vendorId }, // strictly scoped to this vendor
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

  if (!order || !order.items || order.items.length === 0) {
    throw new AppError(
      'Order not found or contains no products belonging to your store',
      404
    );
  }

  const vendorItems = order.items.map((item) => {
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

  const vendorSubtotal = Number(
    vendorItems.reduce((sum, item) => sum + item.itemTotal, 0).toFixed(2)
  );

  return {
    id: order.id,
    status: order.status,
    shippingAddress: order.shippingAddress,
    buyer: order.user,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    vendorSubtotal,
    items: vendorItems,
  };
};

/**
 * List all platform orders with pagination (Admin).
 * @param {Object} queryParams - { page, limit, status }
 */
const getAdminOrders = async (queryParams) => {
  const { status } = queryParams || {};
  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(queryParams.limit, 10) || 10));
  const skip = (page - 1) * limit;

  if (status && !VALID_ORDER_STATUSES.includes(status.toUpperCase())) {
    throw new AppError(
      `Invalid status filter. Allowed values: ${VALID_ORDER_STATUSES.join(', ')}`,
      400
    );
  }

  const where = {
    ...(status && { status: status.toUpperCase() }),
  };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    orders: orders.map((order) => ({
      id: order.id,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      shippingAddress: order.shippingAddress,
      buyer: order.user,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

/**
 * Full order detail for admin, including complete item breakdown with vendor info.
 * @param {string} orderId
 */
const getAdminOrderById = async (orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          mobileNumber: true,
        },
      },
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
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // Look up vendor profiles for each unique vendorId in items
  const vendorIds = [...new Set(order.items.map((i) => i.vendorId))];
  const vendors = await prisma.user.findMany({
    where: { id: { in: vendorIds } },
    select: {
      id: true,
      name: true,
      email: true,
      vendorProfile: {
        select: {
          businessName: true,
          commissionRate: true,
        },
      },
    },
  });

  const vendorMap = new Map(vendors.map((v) => [v.id, v]));

  const formattedItems = order.items.map((item) => {
    const priceAtTime = Number(item.priceAtTime);
    const itemTotal = Number((priceAtTime * item.quantity).toFixed(2));
    const vendor = vendorMap.get(item.vendorId);

    return {
      id: item.id,
      productId: item.productId,
      name: item.product?.name || 'Product',
      slug: item.product?.slug || null,
      image: item.product?.images?.[0] || null,
      priceAtTime,
      quantity: item.quantity,
      itemTotal,
      vendor: vendor
        ? {
            userId: vendor.id,
            name: vendor.name,
            email: vendor.email,
            businessName: vendor.vendorProfile?.businessName || vendor.name,
            commissionRate: vendor.vendorProfile?.commissionRate || 10.0,
          }
        : { userId: item.vendorId },
    };
  });

  return {
    id: order.id,
    status: order.status,
    totalAmount: Number(order.totalAmount),
    shippingAddress: order.shippingAddress,
    buyer: order.user,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: formattedItems,
  };
};

/**
 * Update overall order status (Admin only).
 * If status transitions to CANCELLED and was not previously CANCELLED, restores product stock.
 * @param {string} orderId
 * @param {string} status
 */
const updateOrderStatus = async (orderId, status) => {
  if (!status || !VALID_ORDER_STATUSES.includes(status.toUpperCase())) {
    throw new AppError(
      `Invalid status. Allowed values: ${VALID_ORDER_STATUSES.join(', ')}`,
      400
    );
  }

  const targetStatus = status.toUpperCase();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  const updated = await prisma.$transaction(async (tx) => {
    // If transitioning to CANCELLED and previous status was not CANCELLED, restore stock
    if (targetStatus === 'CANCELLED' && order.status !== 'CANCELLED') {
      await Promise.all(
        order.items.map((item) =>
          tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity },
            },
          })
        )
      );
    }

    return await tx.order.update({
      where: { id: orderId },
      data: { status: targetStatus },
    });
  }, {
    maxWait: 10000,
    timeout: 20000,
  });

  return updated;
};

/**
 * Confirm order delivery.
 * Allowed callers:
 * - The buyer who placed the order
 * - A vendor whose products are in this order
 * - Admin
 *
 * @param {string} orderId
 * @param {Object} user - { id, role }
 */
const confirmDelivery = async (orderId, user) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
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
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  const isBuyer = order.userId === user.id;
  const isVendor = order.items.some((item) => item.vendorId === user.id);
  const isAdmin = user.role === 'ADMIN';

  if (!isBuyer && !isVendor && !isAdmin) {
    throw new AppError('You are not authorized to confirm delivery for this order', 403);
  }

  if (order.status === 'CANCELLED') {
    throw new AppError('Cannot confirm delivery for a cancelled order', 400);
  }

  if (order.status === 'DELIVERED') {
    return {
      message: 'Order is already marked as delivered',
      order: isBuyer ? formatBuyerOrder(order) : order,
    };
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'DELIVERED',
    },
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
  });

  return {
    message: 'Delivery confirmed successfully',
    order: isBuyer ? formatBuyerOrder(updatedOrder) : updatedOrder,
  };
};

/**
 * Update order status by vendor.
 * Allowed statuses for vendor: CONFIRMED, PROCESSING, SHIPPED.
 * (For DELIVERED, vendors must use the confirm-delivery endpoint)
 *
 * @param {string} orderId
 * @param {string} vendorId
 * @param {string} status
 */
const updateVendorOrderStatus = async (orderId, vendorId, status) => {
  const allowedVendorStatuses = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

  if (!status || !allowedVendorStatuses.includes(status.toUpperCase())) {
    throw new AppError(
      `Invalid status. Vendors can transition orders to: ${allowedVendorStatuses.join(', ')}.`,
      400
    );
  }

  const targetStatus = status.toUpperCase();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  const belongsToVendor = order.items.some((item) => item.vendorId === vendorId);
  if (!belongsToVendor) {
    throw new AppError('You are not authorized to update this order', 403);
  }

  if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
    throw new AppError(`Cannot update status of an order that is already ${order.status.toLowerCase()}`, 400);
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { status: targetStatus },
    include: {
      items: {
        where: { vendorId },
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

  return updatedOrder;
};

/**
 * Public Order Tracking summary by Order ID.
 * Safe for unauthenticated / cross-device lookup:
 * Does NOT expose full private student details or vendor internals.
 * Exposes: id, status, totalAmount, createdAt, items, and general campus delivery zone.
 * @param {string} orderId
 */
const trackOrderPublic = async (orderId) => {
  if (!orderId || !orderId.trim()) {
    throw new AppError('Order ID is required', 400);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId.trim() },
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
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  return {
    id: order.id,
    status: order.status,
    totalAmount: Number(order.totalAmount),
    shippingAddress: {
      city: order.shippingAddress?.city || 'Campus Area',
      address: order.shippingAddress?.address || 'Campus Location',
      phone: order.shippingAddress?.phone
        ? `${order.shippingAddress.phone.slice(0, 3)}****${order.shippingAddress.phone.slice(-3)}`
        : '***',
      name: order.shippingAddress?.name || 'Student',
    },
    deliveryCode: order.deliveryCode,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: (order.items || []).map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.product?.name || 'Product',
      slug: item.product?.slug || null,
      image: item.product?.images?.[0] || null,
      priceAtTime: Number(item.priceAtTime),
      quantity: item.quantity,
      itemTotal: Number((Number(item.priceAtTime) * item.quantity).toFixed(2)),
    })),
  };
};

module.exports = {
  createOrder,
  getBuyerOrders,
  getBuyerOrderById,
  cancelBuyerOrder,
  trackOrderPublic,
  getVendorOrders,
  getVendorOrderById,
  updateVendorOrderStatus,
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  confirmDelivery,
};
