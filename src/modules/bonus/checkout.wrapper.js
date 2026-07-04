import { AsyncLocalStorage } from 'async_hooks';
import mongoose from 'mongoose';
import PromoCode from '../../models/PromoCode.js';
import Loyalty from '../../models/Loyalty.js';
import Order from '../orders/order.model.js';

export const checkoutStorage = new AsyncLocalStorage();

// Monkey-patch Order.create to intercept order data and apply discounts/loyalty points
const originalCreate = Order.create;

Order.create = async function (docs, ...args) {
  const store = checkoutStorage.getStore();
  if (store && store.req) {
    const { req } = store;
    const promoCode = req.checkoutPromoCode;
    const redeemPoints = req.checkoutRedeemPoints;
    const userId = docs.userId || (req.user ? req.user.userId : null);

    let subtotal = docs.subtotal;
    let currentTotal = docs.total;

    // 1. Apply Promo Code
    if (promoCode) {
      const promo = await PromoCode.findOne({ code: promoCode.toUpperCase(), isActive: true });
      if (!promo) {
        throw new Error('Promo code is invalid or inactive');
      }

      // Check expiry
      const now = new Date();
      if (promo.startDate && now < promo.startDate) {
        throw new Error('Promo code is not active yet');
      }
      if (promo.endDate && now > promo.endDate) {
        throw new Error('Promo code has expired');
      }

      // Check usage limit
      if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
        throw new Error('Promo code usage limit reached');
      }

      // Check min order amount
      if (subtotal < promo.minOrderAmount) {
        throw new Error(`Minimum order amount of $${promo.minOrderAmount} required for this promo code`);
      }

      let promoDiscount = 0;
      if (promo.discountType === 'percentage') {
        promoDiscount = parseFloat(((subtotal * promo.discountValue) / 100).toFixed(2));
      } else {
        promoDiscount = promo.discountValue;
      }

      promoDiscount = Math.min(promoDiscount, currentTotal);
      currentTotal = parseFloat((currentTotal - promoDiscount).toFixed(2));
      docs.promoCode = promo.code;

      // Increment usage count
      promo.usageCount += 1;
      await promo.save();
    }

    // 2. Redeem Loyalty Points (1 point = $0.10 discount)
    if (redeemPoints && userId) {
      let loyalty = await Loyalty.findOne({ userId });
      if (loyalty && loyalty.points > 0) {
        const maxPointsToRedeem = Math.floor(currentTotal / 0.10);
        const pointsToRedeem = Math.min(loyalty.points, maxPointsToRedeem);
        const loyaltyDiscount = parseFloat((pointsToRedeem * 0.10).toFixed(2));

        currentTotal = parseFloat((currentTotal - loyaltyDiscount).toFixed(2));

        // Deduct points
        loyalty.points -= pointsToRedeem;
        await loyalty.save();

        if (docs.statusHistory && docs.statusHistory.length > 0) {
          docs.statusHistory[0].note += ` | Redeemed ${pointsToRedeem} points ($${loyaltyDiscount} discount)`;
        }
      }
    }

    // Update total
    docs.total = Math.max(0, currentTotal);

    // 3. Earn Loyalty Points (1 point per $10 of final total spent)
    if (userId) {
      const pointsEarned = Math.floor(docs.total / 10);
      if (pointsEarned > 0) {
        let loyalty = await Loyalty.findOne({ userId });
        if (!loyalty) {
          loyalty = new Loyalty({ userId, points: 0 });
        }
        loyalty.points += pointsEarned;
        await loyalty.save();

        if (docs.statusHistory && docs.statusHistory.length > 0) {
          docs.statusHistory[0].note += ` | Earned ${pointsEarned} loyalty points`;
        }
      }
    }
  }

  return originalCreate.call(this, docs, ...args);
};

// Middleware to intercept req.body properties before Joi validation and setup store context
export const checkoutWrapperMiddleware = (req, res, next) => {
  if (req.method === 'POST') {
    const promoCode = req.body.promoCode;
    const redeemPoints = req.body.redeemPoints;

    if (promoCode !== undefined) delete req.body.promoCode;
    if (redeemPoints !== undefined) delete req.body.redeemPoints;

    req.checkoutPromoCode = promoCode;
    req.checkoutRedeemPoints = redeemPoints;

    checkoutStorage.run({ req }, () => {
      next();
    });
  } else {
    next();
  }
};
