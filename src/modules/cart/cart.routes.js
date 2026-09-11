const express = require('express');
const router = express.Router();
const cartController = require('./cart.controller');
const authenticate = require('../../middleware/authenticate');
const requireRole = require('../../middleware/requireRole');

// All cart routes require authentication and the USER role
router.use(authenticate, requireRole(['USER']));

// GET /api/cart -> Get current user's cart with totals and items
router.get('/', cartController.getCart);

// DELETE /api/cart -> Clear entire cart
router.delete('/', cartController.clearCart);

// POST /api/cart/items -> Add item to cart
router.post('/items', cartController.addItem);

// PATCH /api/cart/items/:productId -> Update item quantity
router.patch('/items/:productId', cartController.updateItem);

// DELETE /api/cart/items/:productId -> Remove single item from cart
router.delete('/items/:productId', cartController.removeItem);

module.exports = router;
