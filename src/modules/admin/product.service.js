const prisma = require('../../utils/prisma');
const AppError = require('../../utils/AppError');

/**
 * List all products across all vendors (includes vendor business name in admin view)
 * @param {Object} queryParams - { page, limit, categoryId, isActive }
 */
const listProducts = async (queryParams) => {
  const { page = 1, limit = 10, categoryId, isActive } = queryParams || {};
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const take = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * take;

  const where = {
    ...(categoryId && { categoryId }),
    ...(isActive !== undefined && { isActive: isActive === 'true' || isActive === true }),
  };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            vendorProfile: {
              select: {
                businessName: true,
              },
            },
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    }),
  ]);

  return {
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: Number(p.price),
      stock: p.stock,
      images: p.images,
      isActive: p.isActive,
      isFeatured: p.isFeatured,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      category: p.category,
      vendor: {
        id: p.vendor.id,
        name: p.vendor.name,
        email: p.vendor.email,
        businessName: p.vendor.vendorProfile?.businessName || p.vendor.name,
      },
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
 * Toggle product.isActive (true/false)
 * @param {string} id - Product ID
 */
const toggleProductStatus = async (id) => {
  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  const updatedProduct = await prisma.product.update({
    where: { id },
    data: {
      isActive: !product.isActive,
    },
  });

  return updatedProduct;
};

/**
 * Delete product record
 * @param {string} id - Product ID
 */
const deleteProduct = async (id) => {
  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  // Prevent foreign key failure if product has associated historic order items
  const orderItemsCount = await prisma.orderItem.count({
    where: { productId: id },
  });

  if (orderItemsCount > 0) {
    throw new AppError(
      'Cannot delete product that is referenced in existing customer orders. Consider toggling it to inactive instead.',
      400
    );
  }

  await prisma.product.delete({
    where: { id },
  });

  return { id, name: product.name };
};

module.exports = {
  listProducts,
  toggleProductStatus,
  deleteProduct,
};
