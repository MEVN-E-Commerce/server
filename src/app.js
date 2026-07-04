import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './modules/auth/auth.routes.js';
import productsRouter from './modules/products/products.routes.js';
import cartRouter from './modules/cart/cart.routes.js';
import orderRouter from './modules/orders/order.routes.js';
import paymentsRouter from './modules/payments/payments.routes.js';
import adminRouter from './modules/admin/admin.routes.js';
import { stripeWebhook } from './modules/payments/payments.controller.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

// Standard middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(cookieParser());

// Webhook route must be mounted before express.json()
app.post('/api/v1/payments/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json());

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1', productsRouter);
app.use('/api/v1/cart', cartRouter);
app.use('/api/v1/orders', orderRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/admin', adminRouter);


// Health check route
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Unmatched route handler (404)
app.use(notFound);

// Centralized error handler (mounted last)
app.use(errorHandler);

export default app;
