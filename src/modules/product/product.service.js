const prisma = require('../../utils/prisma');
const AppError = require('../../utils/AppError');
const { generateSlug } = require('../category/category.service');

// Public projection: strictly excludes vendorId, vendor, and vendorProfile information
const PUBLIC_PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  stock: true,
  images: true,
  isFeatured: true,
  featuredUntil: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
};

/**
 * Generate a unique slug for a product, appending a numerical suffix if a collision occurs.
 * @param {string} name
 * @param {string|null} currentProductId
 * @returns {Promise<string>}
 */
const generateUniqueProductSlug = async (name, currentProductId = null) => {
  const baseSlug = generateSlug(name) || 'product';
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing || (currentProductId && existing.id === currentProductId)) {
      return slug;
    }

    slug = `${baseSlug}-${counter++}`;
  }
};

/**
 * Create a new product for the logged-in vendor.
 * @param {string} vendorId
 * @param {Object} productData
 */
const createProduct = async (vendorId, productData) => {
  const {
    name,
    description,
    price,
    stock = 0,
    categoryId,
    images = [],
    isFeatured = false,
    featuredUntil = null,
  } = productData;

  if (!name || !name.trim()) {
    throw new AppError('Product name is required', 400);
  }

  if (!description || !description.trim()) {
    throw new AppError('Product description is required', 400);
  }

  if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) {
    throw new AppError('Product price must be a valid non-negative number', 400);
  }

  if (stock !== undefined && (isNaN(Number(stock)) || Number(stock) < 0)) {
    throw new AppError('Product stock must be a non-negative integer', 400);
  }

  if (!categoryId) {
    throw new AppError('Product categoryId is required', 400);
  }

  // Validate category exists and is active
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });

  if (!category || !category.isActive) {
    throw new AppError('Category does not exist or is inactive', 400);
  }

  const slug = await generateUniqueProductSlug(name.trim());

  const product = await prisma.product.create({
    data: {
      vendorId,
      categoryId,
      name: name.trim(),
      slug,
      description: description.trim(),
      price: Number(price),
      stock: parseInt(stock, 10) || 0,
      images: Array.isArray(images) ? images : [],
      isFeatured: Boolean(isFeatured),
      featuredUntil: featuredUntil ? new Date(featuredUntil) : null,
      isActive: true,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return product;
};

/**
 * List logged-in vendor's own products.
 * @param {string} vendorId
 */
const getVendorProducts = async (vendorId) => {
  return await prisma.product.findMany({
    where: { vendorId },
    orderBy: { createdAt: 'desc' },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
};

/**
 * Get specific product details for the logged-in vendor.
 * Enforces ownership check (vendorId === req.user.id).
 * @param {string} vendorId
 * @param {string} productId
 */
const getVendorProductById = async (vendorId, productId) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  if (product.vendorId !== vendorId) {
    throw new AppError('Access denied — you do not own this product', 403);
  }

  return product;
};

/**
 * Update vendor's own product.
 * Enforces ownership check (vendorId === req.user.id).
 * @param {string} vendorId
 * @param {string} productId
 * @param {Object} updateData
 */
const updateVendorProduct = async (vendorId, productId, updateData) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  if (product.vendorId !== vendorId) {
    throw new AppError('Access denied — you do not own this product', 403);
  }

  const dataToUpdate = {};

  if (updateData.name !== undefined) {
    if (!updateData.name || !updateData.name.trim()) {
      throw new AppError('Product name cannot be empty', 400);
    }
    const trimmedName = updateData.name.trim();
    if (trimmedName.toLowerCase() !== product.name.toLowerCase()) {
      dataToUpdate.slug = await generateUniqueProductSlug(trimmedName, productId);
    }
    dataToUpdate.name = trimmedName;
  }

  if (updateData.description !== undefined) {
    if (!updateData.description || !updateData.description.trim()) {
      throw new AppError('Product description cannot be empty', 400);
    }
    dataToUpdate.description = updateData.description.trim();
  }

  if (updateData.price !== undefined) {
    if (isNaN(Number(updateData.price)) || Number(updateData.price) < 0) {
      throw new AppError('Product price must be a valid non-negative number', 400);
    }
    dataToUpdate.price = Number(updateData.price);
  }

  if (updateData.stock !== undefined) {
    if (isNaN(Number(updateData.stock)) || Number(updateData.stock) < 0) {
      throw new AppError('Product stock must be a non-negative integer', 400);
    }
    dataToUpdate.stock = parseInt(updateData.stock, 10);
  }

  if (updateData.categoryId !== undefined) {
    const category = await prisma.category.findUnique({
      where: { id: updateData.categoryId },
    });
    if (!category || !category.isActive) {
      throw new AppError('Category does not exist or is inactive', 400);
    }
    dataToUpdate.categoryId = updateData.categoryId;
  }

  if (updateData.images !== undefined) {
    if (!Array.isArray(updateData.images)) {
      throw new AppError('Images must be an array of URL strings', 400);
    }
    dataToUpdate.images = updateData.images;
  }

  if (updateData.isFeatured !== undefined) {
    dataToUpdate.isFeatured = Boolean(updateData.isFeatured);
  }

  if (updateData.featuredUntil !== undefined) {
    dataToUpdate.featuredUntil = updateData.featuredUntil
      ? new Date(updateData.featuredUntil)
      : null;
  }

  if (updateData.isActive !== undefined) {
    dataToUpdate.isActive = Boolean(updateData.isActive);
  }

  const updatedProduct = await prisma.product.update({
    where: { id: productId },
    data: dataToUpdate,
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return updatedProduct;
};

/**
 * Soft delete vendor's own product (isActive: false).
 * Enforces ownership check (vendorId === req.user.id).
 * @param {string} vendorId
 * @param {string} productId
 */
const softDeleteVendorProduct = async (vendorId, productId) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  if (product.vendorId !== vendorId) {
    throw new AppError('Access denied — you do not own this product', 403);
  }

  const deactivatedProduct = await prisma.product.update({
    where: { id: productId },
    data: { isActive: false },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return deactivatedProduct;
};

/**
 * List all active products for the public marketplace.
 * STRICT RULE: Never includes vendorId, vendor, or vendorProfile in response.
 * Featured products (isFeatured: true) are sorted first.
 * Supports query params: category (slug), search (keyword), page, limit.
 * @param {Object} queryParams
 */
const getPublicProducts = async (queryParams) => {
  const { category, search, featured, inStock, maxPrice, sortBy, sortOrder } = queryParams;
  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(queryParams.limit, 10) || 9));
  const skip = (page - 1) * limit;

  const where = {
    isActive: true,
    ...(category && {
      category: {
        slug: category.trim().toLowerCase(),
        isActive: true,
      },
    }),
    ...(search && {
      OR: [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ],
    }),
    ...(featured === 'true' && { isFeatured: true }),
    ...(inStock === 'true' && { stock: { gt: 0 } }),
    ...(maxPrice && !isNaN(Number(maxPrice)) && { price: { lte: Number(maxPrice) } }),
  };

  let orderBy = [
    { isFeatured: 'desc' },
    { createdAt: 'desc' },
  ];

  if (sortBy === 'price') {
    orderBy = [{ price: sortOrder === 'asc' ? 'asc' : 'desc' }];
  } else if (sortBy === 'createdAt') {
    orderBy = [{ createdAt: sortOrder === 'asc' ? 'asc' : 'desc' }];
  }

  if (sortBy === 'orderCount' || sortBy === 'orders' || queryParams.topSelling === 'true') {
    const allProducts = await prisma.product.findMany({
      where,
      select: {
        ...PUBLIC_PRODUCT_SELECT,
        orderItems: {
          where: {
            order: {
              status: { not: 'CANCELLED' },
            },
          },
          select: {
            quantity: true,
            orderId: true,
          },
        },
      },
    });

    const ranked = allProducts.map((p) => {
      const uniqueOrderIds = new Set(p.orderItems.map((item) => item.orderId));
      const orderCount = uniqueOrderIds.size;
      const unitsSold = p.orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const { orderItems, ...productData } = p;
      return {
        ...productData,
        orderCount,
        unitsSold,
      };
    });

    ranked.sort((a, b) => {
      if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
      if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold;
      if (b.isFeatured !== a.isFeatured) return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const total = ranked.length;
    const paginatedProducts = ranked.slice(skip, skip + limit);
    const totalPages = Math.ceil(total / limit);

    return {
      products: paginatedProducts,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: PUBLIC_PRODUCT_SELECT,
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    products,
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
 * List top selling products ranked strictly by most order count.
 * Calculates count of unique non-cancelled orders containing each product.
 * Ties are broken by total units sold DESC, then isFeatured DESC, then createdAt DESC.
 * STRICT RULE: Never includes vendorId, vendor, or vendorProfile in response.
 * @param {Object} queryParams - { limit }
 */
const getTopSellingProducts = async (queryParams = {}) => {
  const limit = Math.max(1, Math.min(20, parseInt(queryParams.limit, 10) || 4));

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      ...PUBLIC_PRODUCT_SELECT,
      orderItems: {
        where: {
          order: {
            status: { not: 'CANCELLED' },
          },
        },
        select: {
          quantity: true,
          orderId: true,
        },
      },
    },
  });

  const ranked = products.map((p) => {
    const uniqueOrderIds = new Set(p.orderItems.map((item) => item.orderId));
    const orderCount = uniqueOrderIds.size;
    const unitsSold = p.orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const { orderItems, ...productData } = p;
    return {
      ...productData,
      orderCount,
      unitsSold,
    };
  });

  ranked.sort((a, b) => {
    // 1. Primary: order count DESC (most order count first)
    if (b.orderCount !== a.orderCount) {
      return b.orderCount - a.orderCount;
    }
    // 2. Secondary: units sold DESC
    if (b.unitsSold !== a.unitsSold) {
      return b.unitsSold - a.unitsSold;
    }
    // 3. Featured flag
    if (b.isFeatured !== a.isFeatured) {
      return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
    }
    // 4. Most recent
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return {
    count: Math.min(ranked.length, limit),
    products: ranked.slice(0, limit),
  };
};

/**
 * Get single active product detail by slug for the public marketplace.
 * STRICT RULE: Never includes vendorId, vendor, or vendorProfile in response.
 * @param {string} slug
 */
const getPublicProductBySlug = async (slug) => {
  if (!slug || !slug.trim()) {
    throw new AppError('Product slug is required', 400);
  }

  const product = await prisma.product.findFirst({
    where: {
      slug: slug.trim().toLowerCase(),
      isActive: true,
    },
    select: PUBLIC_PRODUCT_SELECT,
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  return product;
};

module.exports = {
  createProduct,
  getVendorProducts,
  getVendorProductById,
  updateVendorProduct,
  softDeleteVendorProduct,
  getPublicProducts,
  getTopSellingProducts,
  getPublicProductBySlug,
};
