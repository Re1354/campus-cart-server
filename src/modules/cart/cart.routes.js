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

// PATCH or PUT /api/cart/items/:id -> Update item quantity (accepts cartItem.id or productId)
router.patch('/items/:id', cartController.updateItem);
router.put('/items/:id', cartController.updateItem);

// DELETE /api/cart/items/:id -> Remove single item from cart (accepts cartItem.id or productId)
router.delete('/items/:id', cartController.removeItem);

module.exports = router;
