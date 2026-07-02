import { Router } from 'express';
import { register, login, refresh, logout } from './auth.controller.js';
import { validateRegister, validateLogin } from './auth.validators.js';

const router = Router();

// Public auth endpoints
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/refresh', refresh);
router.post('/logout', logout);

/*
 * NOTE: Future role-gated / authenticated endpoints will go below.
 * Example:
 * router.get('/admin-dashboard', authenticateJWT, requireRole('admin'), adminHandler);
 * router.get('/profile', authenticateJWT, profileHandler);
 */

export default router;
