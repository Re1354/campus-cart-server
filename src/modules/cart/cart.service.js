const prisma = require('../../utils/prisma');
const AppError = require('../../utils/AppError');

/**
 * Format cart and its items for client response.
 * Strictly avoids exposing vendorId, vendor business name, or any vendor details.
 *
 * Each item contains:
 * - id
 * - productId
 * - name
 * - price
 * - image (first image from product.images array, or null)
 * - quantity
 * - itemTotal (price * quantity)
 *
 * Overall contains:
 * - id (cart ID)
 * - items (array of formatted items)
 * - cartTotal (sum of itemTotals)
 * - updatedAt
 */
const formatCart = (cart) => {
  if (!cart) {
    return {
      id: null,
      items: [],
      cartTotal: 0,
      itemCount: 0,
      updatedAt: null,
    };
  }

  const items = (cart.items || []).map((cartItem) => {
    const product = cartItem.product;
    const unitPrice = product ? Number(product.price) : 0;
    const itemTotal = Number((unitPrice * cartItem.quantity).toFixed(2));

    return {
      id: cartItem.id,
      productId: cartItem.productId,
      name: product ? product.name : 'Unknown Product',
      price: unitPrice,
      image: product && product.images && product.images.length > 0 ? product.images[0] : null,
      quantity: cartItem.quantity,
      itemTotal,
    };
  });

  const cartTotal = Number(
    items.reduce((sum, item) => sum + item.itemTotal, 0).toFixed(2)
  );

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    id: cart.id,
    items,
    cartTotal,
    totalAmount: cartTotal,
    itemCount,
    updatedAt: cart.updatedAt,
  };
};

/**
 * Helper to fetch a cart with products, strictly projecting only buyer-safe fields.
 * @param {string} userId
 */
const getCartWithItems = async (userId) => {
  return await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              stock: true,
              images: true,
              isActive: true,
            },
          },
        },
        orderBy: { id: 'asc' },
      },
    },
  });
};

/**
 * Helper to ensure user has a cart record.
 * @param {string} userId
 */
const getOrCreateCart = async (userId) => {
  let cart = await prisma.cart.findUnique({
    where: { userId },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
    });
  }

  return cart;
};

/**
 * GET /api/cart
 * Get current user's cart with product details, item totals, and subtotal.
 * @param {string} userId
 */
const getCart = async (userId) => {
  const cart = await getCartWithItems(userId);
  if (!cart) {
    const newCart = await getOrCreateCart(userId);
    return formatCart(newCart);
  }
  return formatCart(cart);
};

/**
 * POST /api/cart/items
 * Add an item to the user's cart. If item already exists, increment its quantity.
 * Validates product exists, is active, and stock is sufficient.
 * @param {string} userId
 * @param {string} productId
 * @param {number} quantity
 */
const addItemToCart = async (userId, productId, quantity = 1) => {
  if (!productId) {
    throw new AppError('Product ID is required', 400);
  }

  const parsedQuantity = parseInt(quantity, 10);
  if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
    throw new AppError('Quantity must be a positive integer', 400);
  }

  // 1. Verify product exists and isActive === true
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      isActive: true,
    },
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  // 2. Ensure cart exists
  const cart = await getOrCreateCart(userId);

  // 3. Check if product already exists in the cart
  const existingItem = await prisma.cartItem.findUnique({
    where: {
      cartId_productId: {
        cartId: cart.id,
        productId,
      },
    },
  });

  const targetQuantity = existingItem
    ? existingItem.quantity + parsedQuantity
    : parsedQuantity;

  // 4. Validate stock availability
  if (targetQuantity > product.stock) {
    throw new AppError('Insufficient stock available', 400);
  }

  // 5. Create or update item in cart
  if (existingItem) {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: targetQuantity },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        quantity: targetQuantity,
      },
    });
  }

  // Touch cart's updatedAt
  await prisma.cart.update({
    where: { id: cart.id },
    data: { updatedAt: new Date() },
  });

  const updatedCart = await getCartWithItems(userId);
  return formatCart(updatedCart);
};

/**
 * PATCH /api/cart/items/:id
 * Update specific item quantity in user's cart.
 * Accepts either productId or cartItem.id as the identifier.
 * @param {string} userId
 * @param {string} identifier
 * @param {number} quantity
 */
const updateCartItemQuantity = async (userId, identifier, quantity) => {
  if (!identifier) {
    throw new AppError('Product ID or Item ID is required', 400);
  }

  const parsedQuantity = parseInt(quantity, 10);
  if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
    throw new AppError('Quantity must be a positive integer', 400);
  }

  // 1. Find user's cart
  const cart = await prisma.cart.findUnique({
    where: { userId },
  });

  if (!cart) {
    throw new AppError('Cart not found', 404);
  }

  // 2. Find cart item by either productId or cartItem.id
  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      OR: [
        { productId: identifier },
        { id: identifier },
      ],
    },
    include: {
      product: true,
    },
  });

  if (!existingItem) {
    throw new AppError('Item not found in cart', 404);
  }

  const product = existingItem.product;
  if (!product || !product.isActive) {
    throw new AppError('Product is no longer available', 404);
  }

  // 3. Validate stock availability
  if (parsedQuantity > product.stock) {
    throw new AppError(`Insufficient stock available (only ${product.stock} available)`, 400);
  }

  // 4. Update quantity
  await prisma.cartItem.update({
    where: { id: existingItem.id },
    data: { quantity: parsedQuantity },
  });

  await prisma.cart.update({
    where: { id: cart.id },
    data: { updatedAt: new Date() },
  });

  const updatedCart = await getCartWithItems(userId);
  return formatCart(updatedCart);
};

/**
 * DELETE /api/cart/items/:id
 * Remove single item from the cart.
 * Accepts either productId or cartItem.id as the identifier.
 * @param {string} userId
 * @param {string} identifier
 */
const removeCartItem = async (userId, identifier) => {
  if (!identifier) {
    throw new AppError('Product ID or Item ID is required', 400);
  }

  const cart = await prisma.cart.findUnique({
    where: { userId },
  });

  if (!cart) {
    throw new AppError('Cart not found', 404);
  }

  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      OR: [
        { productId: identifier },
        { id: identifier },
      ],
    },
  });

  if (!existingItem) {
    throw new AppError('Item not found in cart', 404);
  }

  await prisma.cartItem.delete({
    where: { id: existingItem.id },
  });

  await prisma.cart.update({
    where: { id: cart.id },
    data: { updatedAt: new Date() },
  });

  const updatedCart = await getCartWithItems(userId);
  return formatCart(updatedCart);
};

/**
 * DELETE /api/cart
 * Clear entire cart for user.
 * @param {string} userId
 */
const clearCart = async (userId) => {
  const cart = await prisma.cart.findUnique({
    where: { userId },
  });

  if (cart) {
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });
  }

  const updatedCart = await getCartWithItems(userId);
  return formatCart(updatedCart || cart);
};

module.exports = {
  getCart,
  addItemToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
};
