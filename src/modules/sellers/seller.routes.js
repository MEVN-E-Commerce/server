import { Router } from 'express';
import authenticate from '../../middleware/authenticate.js';
import { requireApprovedSeller } from './seller.middleware.js';
import {
  validateRegisterSeller,
  validateUpdateSellerProfile,
  validateUpdateStock,
  validateUpdateOrderStatus
} from './seller.validators.js';
import {
  registerSeller,
  getSellerProfile,
  updateSellerProfile,
  getDashboardStats,
  getSellerProducts,
  updateProductStock,
  getSellerOrders,
  updateSellerOrderStatus
} from './seller.controller.js';

const router = Router();

// Seller registration (must be logged in as customer first)
router.post('/register', authenticate, validateRegisterSeller, registerSeller);

// Retrieve and update seller profile details
router.get('/profile', authenticate, getSellerProfile);
router.put('/profile', authenticate, validateUpdateSellerProfile, updateSellerProfile);

// Approved seller routes
router.get('/dashboard/stats', authenticate, requireApprovedSeller, getDashboardStats);
router.get('/products', authenticate, requireApprovedSeller, getSellerProducts);
router.patch('/products/:id/stock', authenticate, requireApprovedSeller, validateUpdateStock, updateProductStock);
router.get('/orders', authenticate, requireApprovedSeller, getSellerOrders);
router.patch('/orders/:id/status', authenticate, requireApprovedSeller, validateUpdateOrderStatus, updateSellerOrderStatus);

export default router;
