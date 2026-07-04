import { Router } from 'express';
import { resolveUserOrGuest } from '../cart/guestSession.middleware.js';
import { createCheckoutSession } from './payments.controller.js';

const router = Router();

// Endpoint to generate a Stripe checkout session URL for an order
router.post('/checkout-session', resolveUserOrGuest, createCheckoutSession);

export default router;
