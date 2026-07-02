import config from '../config/env.js';

/**
 * Middleware to handle 404 Not Found errors for unmatched routes.
 */
export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * Centralized global Express error-handling middleware.
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);

  const response = {
    success: false,
    message: err.message || 'Internal Server Error',
  };

  // Include stack trace only in development environment
  if (config.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.json(response);
};
