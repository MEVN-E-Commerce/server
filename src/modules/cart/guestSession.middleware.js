import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import config from '../../config/env.js';

export const resolveUserOrGuest = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1];
      try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        req.user = {
          userId: decoded.userId,
          role: decoded.role
        };
        return next();
      } catch (err) {
        res.status(401);
        return next(new Error('Invalid or expired token'));
      }
    }
  }

  // Guest checkout: check for guest session header
  let guestSessionId = req.headers['x-guest-session-id'];
  if (!guestSessionId) {
    guestSessionId = uuidv4();
    res.setHeader('x-guest-session-id', guestSessionId);
    res.setHeader('Access-Control-Expose-Headers', 'x-guest-session-id');
  }
  req.guestSessionId = guestSessionId;
  next();
};
