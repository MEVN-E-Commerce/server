import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { resolveUserOrGuest } from './guestSession.middleware.js';
import {
  validateBody,
  addToCartSchema,
  updateQuantitySchema,
  mergeCartSchema
} from './cart.validators.js';
import {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
  mergeCarts
} from './cart.controller.js';

const router = Router();

// Retrieve user/guest cart
router.get('/', resolveUserOrGuest, getCart);

// Add item to cart
router.post('/items', resolveUserOrGuest, validateBody(addToCartSchema), addItem);

// Update item quantity (quantity = 0 deletes line)
router.patch('/items/:productId', resolveUserOrGuest, validateBody(updateQuantitySchema), updateItemQuantity);

// Remove item from cart
router.delete('/items/:productId', resolveUserOrGuest, removeItem);

// Clear entire cart
router.delete('/', resolveUserOrGuest, clearCart);

// Merge guest cart into user cart on login
router.post('/merge', authenticate, validateBody(mergeCartSchema), mergeCarts);

export default router;
