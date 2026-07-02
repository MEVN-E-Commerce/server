import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import config from '../../config/env.js';

/**
 * Registers a new user.
 * @param {string} name 
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{user: object, emailVerificationToken: string}>}
 */
export const registerUser = async (name, email, password) => {
  const trimmedEmail = email.toLowerCase().trim();

  // Check if user already exists
  const existingUser = await User.findOne({ email: trimmedEmail });
  if (existingUser) {
    const error = new Error('Email is already registered');
    error.statusCode = 400;
    throw error;
  }

  // Hash password
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Generate verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // Expires in 24 hours

  // Create user
  const user = await User.create({
    name,
    email: trimmedEmail,
    passwordHash,
    emailVerificationToken: verificationToken,
    emailVerificationExpires: tokenExpires
  });

  // Convert to object and strip sensitive fields
  const userObj = user.toObject();
  delete userObj.passwordHash;
  delete userObj.emailVerificationToken;
  delete userObj.emailVerificationExpires;

  return {
    user: userObj,
    emailVerificationToken: verificationToken
  };
};

/**
 * Authenticates a user.
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<object>} Authenticated user object (without sensitive data)
 */
export const loginUser = async (email, password) => {
  const trimmedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: trimmedEmail });

  if (!user) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  if (!user.isActive) {
    const error = new Error('Account is deactivated');
    error.statusCode = 403;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  // Convert to object and strip sensitive fields
  const userObj = user.toObject();
  delete userObj.passwordHash;
  delete userObj.emailVerificationToken;
  delete userObj.emailVerificationExpires;

  return userObj;
};

/**
 * Generates an access token (expires in 15 minutes).
 * @param {object} user 
 * @returns {string} JWT access token
 */
export const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user._id || user.id, role: user.role },
    config.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

/**
 * Generates a refresh token (expires in 7 days).
 * @param {object} user 
 * @returns {string} JWT refresh token
 */
export const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user._id || user.id },
    config.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};
