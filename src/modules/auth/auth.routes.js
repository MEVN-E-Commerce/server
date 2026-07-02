import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
  verifyEmail,
  resendVerification,
  getProfile,
  updateProfile,
  addAddress,
  removeAddress,
  addToWishlist,
  removeFromWishlist
} from "./auth.controller.js";
import {
  validateRegister,
  validateLogin,
  validateResendVerification,
  validateUpdateProfile,
  validateAddAddress,
  validateWishlistBody,
  validateWishlistParams
} from "./auth.validators.js";
import authenticate from "../../middleware/authenticate.js";

const router = Router();

// Public auth endpoints
router.post("/register", validateRegister, register);
router.post("/login", validateLogin, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/verify-email/:token", verifyEmail);
router.post(
  "/resend-verification",
  validateResendVerification,
  resendVerification,
);

// Protected profile & wishlist endpoints
router.get("/profile", authenticate, getProfile);
router.patch("/profile", authenticate, validateUpdateProfile, updateProfile);
router.post("/profile/addresses", authenticate, validateAddAddress, addAddress);
router.delete("/profile/addresses/:addressId", authenticate, removeAddress);
router.post("/wishlist", authenticate, validateWishlistBody, addToWishlist);
router.delete("/wishlist/:productId", authenticate, validateWishlistParams, removeFromWishlist);

export default router;
