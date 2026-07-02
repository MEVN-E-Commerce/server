import * as authService from './auth.service.js';
import jwt from 'jsonwebtoken';
import config from '../../config/env.js';
import User from '../../models/User.js';

/**
 * Registers a new user and logs the verification token to the console.
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const { user, emailVerificationToken } = await authService.registerUser(name, email, password);

    // Log the verification token for local debugging / CLI retrieval
    // TODO: send via Nodemailer/queue
    console.log(`[AUTH] Verification token for ${email}: ${emailVerificationToken}`);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      user
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

/**
 * Log in the user, issue tokens, and set the refresh token in an HTTP-only cookie.
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await authService.loginUser(email, password);

    const accessToken = authService.generateAccessToken(user);
    const refreshToken = authService.generateRefreshToken(user);

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false, // false for local development
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
    });

    res.status(200).json({
      success: true,
      accessToken,
      user
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

/**
 * Verify refresh token and issue a new access token.
 */
export const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      const error = new Error('Refresh token is missing');
      error.statusCode = 401;
      throw error;
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET);
    } catch (err) {
      const error = new Error('Invalid or expired refresh token');
      error.statusCode = 401;
      throw error;
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 401;
      throw error;
    }

    if (!user.isActive) {
      const error = new Error('User account is deactivated');
      error.statusCode = 401;
      throw error;
    }

    const accessToken = authService.generateAccessToken(user);

    const userObj = user.toObject();
    delete userObj.passwordHash;
    delete userObj.emailVerificationToken;
    delete userObj.emailVerificationExpires;

    res.status(200).json({
      success: true,
      accessToken,
      user: userObj
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

/**
 * Log out the user by clearing the refresh token cookie.
 */
export const logout = async (req, res, next) => {
  try {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax'
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};
