import PromoCode from '../../models/PromoCode.js';
import Review, { updateProductAggregateRating } from '../../models/Review.js';
import Loyalty from '../../models/Loyalty.js';
import Product from '../../models/Product.js';

// ─── PROMO CODES ───────────────────────────────────────────────────────────
export const createPromoCode = async (req, res, next) => {
  try {
    const { code, discountType, discountValue, minOrderAmount, startDate, endDate, isActive, usageLimit } = req.body;

    const existing = await PromoCode.findOne({ code: code.toUpperCase() });
    if (existing) {
      res.status(400);
      return next(new Error('Promo code already exists'));
    }

    const promo = await PromoCode.create({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      minOrderAmount,
      startDate,
      endDate,
      isActive,
      usageLimit
    });

    res.status(201).json({ success: true, message: 'Promo code created successfully', promoCode: promo });
  } catch (err) {
    next(err);
  }
};

export const getPromoCodes = async (req, res, next) => {
  try {
    const promos = await PromoCode.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: promos.length, promoCodes: promos });
  } catch (err) {
    next(err);
  }
};

export const validatePromoCode = async (req, res, next) => {
  try {
    const { code } = req.params;
    const subtotal = parseFloat(req.query.subtotal || 0);

    const promo = await PromoCode.findOne({ code: code.toUpperCase(), isActive: true });
    if (!promo) {
      res.status(404);
      return next(new Error('Promo code not found or inactive'));
    }

    // Check expiry
    const now = new Date();
    if (promo.startDate && now < promo.startDate) {
      res.status(400);
      return next(new Error('Promo code is not active yet'));
    }
    if (promo.endDate && now > promo.endDate) {
      res.status(400);
      return next(new Error('Promo code has expired'));
    }

    // Check usage limit
    if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
      res.status(400);
      return next(new Error('Promo code usage limit reached'));
    }

    // Check min order amount
    if (subtotal < promo.minOrderAmount) {
      res.status(400);
      return next(new Error(`Minimum order amount of $${promo.minOrderAmount} required`));
    }

    let discount = 0;
    if (promo.discountType === 'percentage') {
      discount = parseFloat(((subtotal * promo.discountValue) / 100).toFixed(2));
    } else {
      discount = Math.min(promo.discountValue, subtotal);
    }

    res.status(200).json({ success: true, valid: true, promoCode: promo, discount });
  } catch (err) {
    next(err);
  }
};

export const updatePromoCode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.code) updates.code = updates.code.toUpperCase();

    const promo = await PromoCode.findByIdAndUpdate(id, { $set: updates }, { new: true });
    if (!promo) {
      res.status(404);
      return next(new Error('Promo code not found'));
    }

    res.status(200).json({ success: true, message: 'Promo code updated successfully', promoCode: promo });
  } catch (err) {
    next(err);
  }
};

export const deletePromoCode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const promo = await PromoCode.findByIdAndDelete(id);
    if (!promo) {
      res.status(404);
      return next(new Error('Promo code not found'));
    }
    res.status(200).json({ success: true, message: 'Promo code deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── REVIEWS ───────────────────────────────────────────────────────────────
export const createReview = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { productId, rating, comment } = req.body;

    if (!productId || !rating) {
      res.status(400);
      return next(new Error('Product ID and rating are required'));
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404);
      return next(new Error('Product not found'));
    }

    // Check if user already reviewed this product
    const existing = await Review.findOne({ userId, productId });
    if (existing) {
      res.status(400);
      return next(new Error('You have already reviewed this product'));
    }

    const review = await Review.create({
      userId,
      productId,
      rating,
      comment
    });

    res.status(201).json({ success: true, message: 'Review added successfully', review });
  } catch (err) {
    next(err);
  }
};

export const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({ productId }).populate('userId', 'name email').sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: reviews.length, reviews });
  } catch (err) {
    next(err);
  }
};

// ─── LOYALTY POINTS ────────────────────────────────────────────────────────
export const getLoyaltyPoints = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    let loyalty = await Loyalty.findOne({ userId });
    if (!loyalty) {
      loyalty = await Loyalty.create({ userId, points: 0 });
    }
    res.status(200).json({ success: true, points: loyalty.points });
  } catch (err) {
    next(err);
  }
};
