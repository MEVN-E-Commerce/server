import { Router } from 'express';
import authenticate from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requireRole.js';
import {
  createPromoCode,
  getPromoCodes,
  validatePromoCode,
  updatePromoCode,
  deletePromoCode,
  createReview,
  getProductReviews,
  getLoyaltyPoints
} from './bonus.controller.js';

const router = Router();

// Promo codes management (Admin / Seller)
router.post('/promo-codes', authenticate, requireRole('admin', 'seller'), createPromoCode);
router.get('/promo-codes', authenticate, requireRole('admin', 'seller'), getPromoCodes);
router.get('/promo-codes/:code/validate', validatePromoCode);
router.put('/promo-codes/:id', authenticate, requireRole('admin'), updatePromoCode);
router.delete('/promo-codes/:id', authenticate, requireRole('admin'), deletePromoCode);

// Reviews (Public reads, authenticated customer writes)
router.post('/reviews', authenticate, createReview);
router.get('/reviews/product/:productId', getProductReviews);

// Loyalty Points (Authenticated users only)
router.get('/loyalty', authenticate, getLoyaltyPoints);

export default router;
