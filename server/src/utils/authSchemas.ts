import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .transform((email) => email.toLowerCase());

export const strongPasswordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a symbol");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1)
});

export const forgotPasswordSchema = z.object({
  email: emailSchema
});

export const verifyResetOtpSchema = z.object({
  email: emailSchema,
  otp: z.string().regex(/^\d{6}$/, "OTP must contain exactly 6 digits")
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, "Reset token is required"),
  newPassword: strongPasswordSchema
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password")
  })
  .refine((input) => input.newPassword === input.confirmPassword, {
    message: "New password and confirmation must match",
    path: ["confirmPassword"]
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyResetOtpInput = z.infer<typeof verifyResetOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
