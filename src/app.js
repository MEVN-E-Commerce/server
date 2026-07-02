import express from 'express';
import cors from 'cors';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

// Standard middlewares
app.use(cors());
app.use(express.json());

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
