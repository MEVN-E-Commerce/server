import * as authService from "./auth.service.js";
import jwt from "jsonwebtoken";
import config from "../../config/env.js";
import { sendVerificationEmail } from "../../services/email.service.js";
import User from "../../models/User.js";

/**
 * Registers a new user and logs the verification token to the console.
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const { user, emailVerificationToken } = await authService.registerUser(name, email, password);

    await sendVerificationEmail({ email, name: user.name, token: emailVerificationToken });

    res.status(201).json({ success: true, message: "Registration successful. Please check your email to verify your account.", user });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

//Log in the user, issue tokens, and set the refresh token in an HTTP-only cookie.

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await authService.loginUser(email, password);

    const accessToken = authService.generateAccessToken(user);
    const refreshToken = authService.generateRefreshToken(user);

    // Set refresh token cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false, // false for local development
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });

    res.status(200).json({
      success: true,
      accessToken,
      user,
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

//  Verify refresh token and issue a new access token.
export const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      const error = new Error("Refresh token is missing");
      error.statusCode = 401;
      throw error;
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET);
    } catch (err) {
      const error = new Error("Invalid or expired refresh token");
      error.statusCode = 401;
      throw error;
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 401;
      throw error;
    }

    if (!user.isActive) {
      const error = new Error("User account is deactivated");
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
      user: userObj,
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

// Log out the user by clearing the refresh token cookie.

export const logout = async (req, res, next) => {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

// Verify user's email with the provided token.

export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    await authService.verifyEmail(token);

    res.status(200).json({
      success: true,
      message: "Email verified successfully. You can now log in.",
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.resendVerificationEmail(email);
    if (result) await sendVerificationEmail(result);

    res.status(200).json({ success: true, message: "If an account exists, a new verification email has been sent" });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

/**
 * Retrieve current user's profile.
 */
export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const profile = await authService.getProfile(userId);
    res.status(200).json({
      success: true,
      user: profile
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

/**
 * Update current user's profile name and/or addresses.
 */
export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { name, addresses } = req.body;
    
    const updatedProfile = await authService.updateProfile(userId, { name, addresses });
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedProfile
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

/**
 * Add a new address to user profile.
 */
export const addAddress = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const addresses = await authService.addAddress(userId, req.body);
    res.status(200).json({
      success: true,
      message: "Address added successfully",
      addresses
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

/**
 * Remove an address from user profile.
 */
export const removeAddress = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { addressId } = req.params;
    const addresses = await authService.removeAddress(userId, addressId);
    res.status(200).json({
      success: true,
      message: "Address removed successfully",
      addresses
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

/**
 * Add a product to user's wishlist.
 */
export const addToWishlist = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.body;
    const wishlist = await authService.addToWishlist(userId, productId);
    res.status(200).json({
      success: true,
      message: "Product added to wishlist successfully",
      wishlist
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};

/**
 * Remove a product from user's wishlist.
 */
export const removeFromWishlist = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.params;
    const wishlist = await authService.removeFromWishlist(userId, productId);
    res.status(200).json({
      success: true,
      message: "Product removed from wishlist successfully",
      wishlist
    });
  } catch (err) {
    res.status(err.statusCode || 500);
    next(err);
  }
};
