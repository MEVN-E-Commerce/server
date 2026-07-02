import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
  verifyEmail,
  resendVerification,
} from "./auth.controller.js";
import {
  validateRegister,
  validateLogin,
  validateResendVerification,
} from "./auth.validators.js";

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

export default router;
