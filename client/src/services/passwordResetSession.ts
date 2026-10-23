const resetEmailKey = "talme_password_reset_email";
const resetTokenKey = "talme_password_reset_token";
const resendAvailableAtKey = "talme_password_reset_resend_at";

export function getResetEmail() {
  return sessionStorage.getItem(resetEmailKey);
}

export function setResetEmail(email: string) {
  sessionStorage.setItem(resetEmailKey, email);
}

export function getResetToken() {
  return sessionStorage.getItem(resetTokenKey);
}

export function setResetToken(token: string) {
  sessionStorage.setItem(resetTokenKey, token);
}

export function getResendAvailableAt() {
  return Number(sessionStorage.getItem(resendAvailableAtKey) ?? 0);
}

export function setResendAvailableAt(timestamp: number) {
  sessionStorage.setItem(resendAvailableAtKey, timestamp.toString());
}

export function clearPasswordResetSession() {
  sessionStorage.removeItem(resetEmailKey);
  sessionStorage.removeItem(resetTokenKey);
  sessionStorage.removeItem(resendAvailableAtKey);
}
