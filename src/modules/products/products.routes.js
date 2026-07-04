import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requireRole.js';
import { upload } from '../../utils/cloudinary.js';

import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} from './category.controller.js';

import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadImagesHandler
} from './product.controller.js';

const router = Router();

// ==========================================
// CATEGORIES ROUTES
// ==========================================
// Public reads
router.get('/categories', getCategories);
router.get('/categories/:id', getCategoryById);

// Admin-only writes
router.post('/categories', authenticate, requireRole('admin'), createCategory);
router.put('/categories/:id', authenticate, requireRole('admin'), updateCategory);
router.delete('/categories/:id', authenticate, requireRole('admin'), deleteCategory);


// ==========================================
// PRODUCTS ROUTES
// ==========================================
// Public reads (includes name search & filtering via query status)
router.get('/products', getProducts);
router.get('/products/:id', getProductById);

// Seller/Admin writes
router.post('/products', authenticate, requireRole('seller', 'admin'), createProduct);
router.put('/products/:id', authenticate, requireRole('seller', 'admin'), updateProduct);
router.delete('/products/:id', authenticate, requireRole('seller', 'admin'), deleteProduct);

// Image uploading route (supports up to 5 images)
router.post(
  '/products/upload',
  authenticate,
  requireRole('seller', 'admin'),
  upload.array('images', 5),
  uploadImagesHandler
);

// Banners public endpoint
import Banner from '../../models/Banner.js';
router.get('/banners', async (req, res, next) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
    res.status(200).json({ success: true, banners });
  } catch (err) {
    next(err);
  }
});

export default router;
