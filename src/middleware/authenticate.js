/**
 * Middleware to authenticate requests using JWT.
 * 
 * Intended usage pattern:
 * import { authenticate } from '../../middleware/authenticate.js';
 * import { requireRole } from '../../middleware/requireRole.js';
 * 
 * router.get('/admin-only', authenticate, requireRole('admin'), controllerFn);
 */

import jwt from 'jsonwebtoken';
import config from '../config/env.js';

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401);
    return next(new Error('No token provided'));
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401);
    return next(new Error('No token provided'));
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      role: decoded.role
    };
    next();
  } catch (err) {
    res.status(401);
    return next(new Error('Invalid or expired token'));
  }
};

export default authenticate;
