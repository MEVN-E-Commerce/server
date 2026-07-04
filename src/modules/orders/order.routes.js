import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requireRole.js';
import { resolveUserOrGuest } from '../cart/guestSession.middleware.js';
import {
  validatePlaceOrder,
  validateBody,
  updateStatusSchema
} from './order.validators.js';
import {
  placeOrder,
  getMyOrders,
  getOrderById,
  trackOrder,
  updateOrderStatus
} from './order.controller.js';

const router = Router();

// Place an order (supports user checkout and guest checkout)
router.post('/', resolveUserOrGuest, validatePlaceOrder, placeOrder);

// Retrieve logged-in user's orders
router.get('/', authenticate, getMyOrders);

// Track order (by guest email or authenticated owner/admin)
router.get('/track/:id', resolveUserOrGuest, trackOrder);

// Retrieve single order (owner or admin only)
router.get('/:id', authenticate, getOrderById);

// Update order status (Admin/Seller only, validates status transition)
router.patch('/:id/status', authenticate, requireRole('admin', 'seller'), validateBody(updateStatusSchema), updateOrderStatus);

export default router;
