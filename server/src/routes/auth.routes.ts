import { Router } from "express";
import {
  completePasswordReset,
  changePassword,
  forgotPassword,
  login,
  me,
  resendResetOtp,
  verifyResetOtp
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  passwordResetCompleteLimiter,
  passwordResetRequestLimiter,
  passwordResetVerifyLimiter
} from "../middleware/passwordResetRateLimit.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  forgotPasswordSchema,
  changePasswordSchema,
  loginSchema,
  resetPasswordSchema,
  verifyResetOtpSchema
} from "../utils/authSchemas.js";

export const authRouter = Router();

authRouter.post("/login", validate(loginSchema), login);
authRouter.post(
  "/forgot-password",
  passwordResetRequestLimiter,
  validate(forgotPasswordSchema),
  forgotPassword
);
authRouter.post(
  "/resend-reset-otp",
  passwordResetRequestLimiter,
  validate(forgotPasswordSchema),
  resendResetOtp
);
authRouter.post(
  "/verify-reset-otp",
  passwordResetVerifyLimiter,
  validate(verifyResetOtpSchema),
  verifyResetOtp
);
authRouter.post(
  "/reset-password",
  passwordResetCompleteLimiter,
  validate(resetPasswordSchema),
  completePasswordReset
);
authRouter.get("/me", authenticate, me);
authRouter.post("/change-password", authenticate, validate(changePasswordSchema), changePassword);
