import assert from "node:assert/strict";
import test from "node:test";
import { resetPasswordSchema } from "./authSchemas.js";
import { generateNumericOtp, hashOtp, verifyOtpHash } from "./passwordResetSecurity.js";

test("generates a six-digit numeric OTP", () => {
  assert.match(generateNumericOtp(), /^\d{6}$/);
});

test("verifies the correct OTP and rejects a different OTP", () => {
  const secret = "test-only-otp-secret";
  const otpHash = hashOtp("123456", secret);

  assert.equal(verifyOtpHash("123456", otpHash, secret), true);
  assert.equal(verifyOtpHash("654321", otpHash, secret), false);
  assert.notEqual(otpHash, "123456");
});

test("enforces the reset password policy", () => {
  assert.equal(
    resetPasswordSchema.safeParse({ resetToken: "token", newPassword: "Strong!Pass123" }).success,
    true
  );
  assert.equal(
    resetPasswordSchema.safeParse({ resetToken: "token", newPassword: "weakpass" }).success,
    false
  );
});
