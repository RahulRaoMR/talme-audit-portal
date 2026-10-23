import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export function generateNumericOtp() {
  return randomInt(100_000, 1_000_000).toString();
}

export function hashOtp(otp: string, secret: string) {
  return createHmac("sha256", secret).update(otp).digest("hex");
}

export function verifyOtpHash(otp: string, otpHash: string, secret: string) {
  const suppliedHash = Buffer.from(hashOtp(otp, secret), "hex");
  const storedHash = Buffer.from(otpHash, "hex");

  return suppliedHash.length === storedHash.length && timingSafeEqual(suppliedHash, storedHash);
}
