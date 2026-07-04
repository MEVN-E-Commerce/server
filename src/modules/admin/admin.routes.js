import { Router } from 'express';
import authenticate from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requireRole.js';
import { upload } from '../../utils/cloudinary.js';
import {
  getDashboard,
  getUsers, getUserById, updateUserStatus,
  getProducts, updateProductStatus,
  getOrders, getOrderById, updateOrderStatus, updateOrderShipping,
  getBanners, createBanner, updateBanner, updateBannerStatus, deleteBanner, uploadBannerImage
} from './admin.controller.js';
import {
  validateUpdateUserStatus,
  validateUpdateProductStatus,
  validateUpdateShipping,
  validateCreateBanner,
  validateUpdateBanner,
  validateUpdateBannerStatus
} from './admin.validators.js';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireRole('admin'));

// ─── Dashboard ─────────────────────────────────────────────────────────────
router.get('/dashboard', getDashboard);

// ─── Users ─────────────────────────────────────────────────────────────────
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id/status', validateUpdateUserStatus, updateUserStatus);

// ─── Products ──────────────────────────────────────────────────────────────
router.get('/products', getProducts);
router.patch('/products/:id/status', validateUpdateProductStatus, updateProductStatus);

// ─── Orders ────────────────────────────────────────────────────────────────
router.get('/orders', getOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id/status', updateOrderStatus);
router.patch('/orders/:id/shipping', validateUpdateShipping, updateOrderShipping);

// ─── Banners ───────────────────────────────────────────────────────────────
router.get('/banners', getBanners);
router.post('/banners', validateCreateBanner, createBanner);
router.put('/banners/:id', validateUpdateBanner, updateBanner);
router.patch('/banners/:id/status', validateUpdateBannerStatus, updateBannerStatus);
router.delete('/banners/:id', deleteBanner);
router.post('/banners/upload', upload.single('image'), uploadBannerImage);

export default router;
