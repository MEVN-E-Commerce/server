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
  const { token: verificationToken, expires: tokenExpires } = generateVerificationToken();

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

/**
 * Generates verification token and expiry time.
 * @returns {{token: string, expires: Date}}
 */
const generateVerificationToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return { token, expires };
};

/**
 * Verifies user email by token.
 * @param {string} token
 */
export const verifyEmail = async (token) => {
  if (!token) {
    const error = new Error('Verification token is required');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ emailVerificationToken: token });

  if (!user || !user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
    const error = new Error('Invalid or expired verification token');
    error.statusCode = 400;
    throw error;
  }

  user.isVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();
};

/**
 * Resends verification email.
 * @param {string} email
 */
export const resendVerificationEmail = async (email) => {
  const trimmedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: trimmedEmail });

  if (!user) {
    // Return silently to avoid leaking whether email exists
    return;
  }

  if (user.isVerified) {
    // Already verified, no-op
    return;
  }

  const { token, expires } = generateVerificationToken();
  user.emailVerificationToken = token;
  user.emailVerificationExpires = expires;
  await user.save();

  // Log token for CLI retrieval
  // TODO: send via Nodemailer/queue
  console.log(`[AUTH] Verification token for ${user.email}: ${token}`);
};
