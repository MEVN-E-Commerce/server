/**
 * Middleware to restrict access to routes based on user roles.
 * 
 * Intended usage pattern:
 * import { authenticate } from '../../middleware/authenticate.js';
 * import { requireRole } from '../../middleware/requireRole.js';
 * 
 * router.get('/admin-only', authenticate, requireRole('admin'), controllerFn);
 */

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401);
      return next(new Error('Not authenticated'));
    }

    if (!req.user.role || !allowedRoles.includes(req.user.role)) {
      res.status(403);
      return next(new Error('Forbidden — insufficient permissions'));
    }

    next();
  };
};

export default requireRole;
