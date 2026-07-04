import User from '../../models/User.js';

export const requireApprovedSeller = async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401);
      return next(new Error('Not authenticated'));
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(401);
      return next(new Error('User not found'));
    }

    if (user.role !== 'seller' && user.role !== 'admin') {
      res.status(403);
      return next(new Error('Forbidden — insufficient permissions'));
    }

    if (user.role === 'seller' && user.sellerStatus !== 'approved') {
      res.status(403);
      return next(new Error('Forbidden — seller account is not approved'));
    }

    req.fullUser = user;
    next();
  } catch (err) {
    next(err);
  }
};
