import type { Request, Response } from "express";
import {
  changeUserPassword,
  getUserProfile,
  loginUser
} from "../services/auth.service.js";
import {
  requestPasswordReset,
  resendPasswordResetOtp,
  resetPassword,
  verifyPasswordResetOtp
} from "../services/passwordReset.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type {
  ForgotPasswordInput,
  ChangePasswordInput,
  LoginInput,
  ResetPasswordInput,
  VerifyResetOtpInput
} from "../utils/authSchemas.js";
import { HttpError } from "../utils/httpError.js";

export const login = asyncHandler(
  async (req: Request<unknown, unknown, LoginInput>, res: Response) => {
    const result = await loginUser(req.body);
    res.json(result);
  }
);

export const me = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new HttpError(401, "Authentication is required");
  }

  const user = await getUserProfile(req.auth.userId);
  res.json({ user });
});

export const changePassword = asyncHandler(
  async (req: Request<unknown, unknown, ChangePasswordInput>, res: Response) => {
    if (!req.auth) {
      throw new HttpError(401, "Authentication is required");
    }

    const result = await changeUserPassword(req.auth.userId, req.body);
    res.json(result);
  }
);

export const forgotPassword = asyncHandler(
  async (req: Request<unknown, unknown, ForgotPasswordInput>, res: Response) => {
    const result = await requestPasswordReset(req.body);
    res.json(result);
  }
);

export const resendResetOtp = asyncHandler(
  async (req: Request<unknown, unknown, ForgotPasswordInput>, res: Response) => {
    const result = await resendPasswordResetOtp(req.body);
    res.json(result);
  }
);

export const verifyResetOtp = asyncHandler(
  async (req: Request<unknown, unknown, VerifyResetOtpInput>, res: Response) => {
    const result = await verifyPasswordResetOtp(req.body);
    res.json(result);
  }
);

export const completePasswordReset = asyncHandler(
  async (req: Request<unknown, unknown, ResetPasswordInput>, res: Response) => {
    const result = await resetPassword(req.body);
    res.json(result);
  }
);
