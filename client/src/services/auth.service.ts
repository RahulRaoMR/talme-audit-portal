import { apiRequest } from "./api";
import type { AuthResponse, UserProfile } from "../types/auth";

export type LoginRequest = {
  email: string;
  password: string;
};

type MessageResponse = {
  message: string;
};

export function loginRequest(input: LoginRequest) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function fetchCurrentUser() {
  return apiRequest<{ user: UserProfile }>("/auth/me");
}

export function forgotPasswordRequest(email: string) {
  return apiRequest<MessageResponse>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export function resendResetOtpRequest(email: string) {
  return apiRequest<MessageResponse>("/auth/resend-reset-otp", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export function verifyResetOtpRequest(email: string, otp: string) {
  return apiRequest<MessageResponse & { resetToken: string }>("/auth/verify-reset-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp })
  });
}

export function resetPasswordRequest(resetToken: string, newPassword: string) {
  return apiRequest<MessageResponse>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ resetToken, newPassword })
  });
}

export function changePasswordRequest(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
) {
  return apiRequest<MessageResponse>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
  });
}
