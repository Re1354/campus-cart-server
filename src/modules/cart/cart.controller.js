const catchAsync = require('../../utils/catchAsync');
const cartService = require('./cart.service');

/**
 * GET /api/cart
 * Get current user's shopping cart with item totals and overall subtotal
 */
exports.getCart = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const cart = await cartService.getCart(userId);

  res.status(200).json({
    cart,
  });
});

/**
 * POST /api/cart/items
 * Add an item to user's cart (or increment quantity if already present)
 */
exports.addItem = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { productId, quantity } = req.body;
  const cart = await cartService.addItemToCart(userId, productId, quantity);

  res.status(200).json({
    message: 'Item added to cart',
    cart,
  });
});

/**
 * PATCH /api/cart/items/:productId
 * Update item quantity in user's cart
 */
exports.updateItem = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const identifier = req.params.id || req.params.productId;
  const { quantity } = req.body;
  const cart = await cartService.updateCartItemQuantity(userId, identifier, quantity);

  res.status(200).json({
    message: 'Cart item updated',
    cart,
  });
});

/**
 * DELETE /api/cart/items/:id (or :productId)
 * Remove single item from user's cart
 */
exports.removeItem = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const identifier = req.params.id || req.params.productId;
  const cart = await cartService.removeCartItem(userId, identifier);

  res.status(200).json({
    message: 'Item removed from cart',
    cart,
  });
});

/**
 * DELETE /api/cart
 * Clear entire cart for user
 */
exports.clearCart = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const cart = await cartService.clearCart(userId);

  res.status(200).json({
    message: 'Cart cleared successfully',
    cart,
  });
});
