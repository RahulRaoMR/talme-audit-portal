import bcrypt from "bcrypt";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import type {
  ForgotPasswordInput,
  ResetPasswordInput,
  VerifyResetOtpInput
} from "../utils/authSchemas.js";
import { HttpError } from "../utils/httpError.js";
import { generateNumericOtp, hashOtp, verifyOtpHash } from "../utils/passwordResetSecurity.js";
import { sendPasswordResetOtp } from "./email.service.js";

const otpLifetimeMs = 10 * 60 * 1000;
const resendCooldownMs = 60 * 1000;
const maximumOtpAttempts = 5;
const passwordSaltRounds = 12;
const resetTokenAudience = "talme-password-reset";
const resetTokenIssuer = "talme-employee-audit-api";

export const genericResetRequestMessage =
  "If this email is registered, an OTP has been sent.";

async function issuePasswordResetOtp(input: ForgotPasswordInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      isActive: true,
      employee: {
        select: { firstName: true }
      }
    }
  });

  if (!user?.isActive) {
    return { message: genericResetRequestMessage };
  }

  const latestRequest = await prisma.passwordResetOtp.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true }
  });

  if (latestRequest && Date.now() - latestRequest.createdAt.getTime() < resendCooldownMs) {
    return { message: genericResetRequestMessage };
  }

  const otp = generateNumericOtp();
  const otpHash = hashOtp(otp, env.passwordResetOtpSecret);
  const now = new Date();

  const [, resetRecord] = await prisma.$transaction([
    prisma.passwordResetOtp.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now }
    }),
    prisma.passwordResetOtp.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt: new Date(now.getTime() + otpLifetimeMs)
      },
      select: { id: true }
    })
  ]);

  try {
    await sendPasswordResetOtp({
      to: user.email,
      firstName: user.employee?.firstName ?? "Talme Employee",
      otp
    });
  } catch {
    await prisma.passwordResetOtp.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() }
    });
    console.error("Password reset email delivery failed");
  }

  return { message: genericResetRequestMessage };
}

export function requestPasswordReset(input: ForgotPasswordInput) {
  return issuePasswordResetOtp(input);
}

export function resendPasswordResetOtp(input: ForgotPasswordInput) {
  return issuePasswordResetOtp(input);
}

export async function verifyPasswordResetOtp(input: VerifyResetOtpInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, isActive: true }
  });

  if (!user?.isActive) {
    throw new HttpError(400, "Invalid or expired OTP");
  }

  const resetRecord = await prisma.passwordResetOtp.findFirst({
    where: { userId: user.id, usedAt: null },
    orderBy: { createdAt: "desc" }
  });

  if (!resetRecord || resetRecord.verifiedAt || resetRecord.attemptCount >= maximumOtpAttempts) {
    throw new HttpError(400, "Invalid or expired OTP");
  }

  if (resetRecord.expiresAt <= new Date()) {
    await prisma.passwordResetOtp.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() }
    });
    throw new HttpError(400, "OTP has expired. Request a new code.");
  }

  if (!verifyOtpHash(input.otp, resetRecord.otpHash, env.passwordResetOtpSecret)) {
    const nextAttemptCount = resetRecord.attemptCount + 1;
    await prisma.passwordResetOtp.update({
      where: { id: resetRecord.id },
      data: {
        attemptCount: nextAttemptCount,
        usedAt: nextAttemptCount >= maximumOtpAttempts ? new Date() : undefined
      }
    });

    throw new HttpError(
      400,
      nextAttemptCount >= maximumOtpAttempts
        ? "Too many invalid attempts. Request a new code."
        : "Invalid OTP"
    );
  }

  const verifiedAt = new Date();
  const claimed = await prisma.passwordResetOtp.updateMany({
    where: {
      id: resetRecord.id,
      usedAt: null,
      verifiedAt: null,
      attemptCount: { lt: maximumOtpAttempts },
      expiresAt: { gt: verifiedAt }
    },
    data: { verifiedAt }
  });

  if (claimed.count !== 1) {
    throw new HttpError(400, "Invalid or expired OTP");
  }

  const resetToken = jwt.sign(
    { purpose: "password_reset" },
    env.passwordResetJwtSecret,
    {
      algorithm: "HS256",
      subject: user.id,
      jwtid: resetRecord.id,
      audience: resetTokenAudience,
      issuer: resetTokenIssuer,
      expiresIn: "10m"
    }
  );

  return { message: "OTP verified", resetToken };
}

function verifyResetToken(resetToken: string) {
  let payload: string | JwtPayload;

  try {
    payload = jwt.verify(resetToken, env.passwordResetJwtSecret, {
      algorithms: ["HS256"],
      audience: resetTokenAudience,
      issuer: resetTokenIssuer
    });
  } catch {
    throw new HttpError(400, "Reset session is invalid or has expired");
  }

  if (
    typeof payload === "string" ||
    payload.purpose !== "password_reset" ||
    typeof payload.sub !== "string" ||
    typeof payload.jti !== "string"
  ) {
    throw new HttpError(400, "Reset session is invalid or has expired");
  }

  return { userId: payload.sub, resetOtpId: payload.jti };
}

export async function resetPassword(input: ResetPasswordInput) {
  const { userId, resetOtpId } = verifyResetToken(input.resetToken);
  const passwordHash = await bcrypt.hash(input.newPassword, passwordSaltRounds);
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    const claimed = await transaction.passwordResetOtp.updateMany({
      where: {
        id: resetOtpId,
        userId,
        usedAt: null,
        verifiedAt: { not: null },
        expiresAt: { gt: now }
      },
      data: { usedAt: now }
    });

    if (claimed.count !== 1) {
      throw new HttpError(400, "Reset session is invalid or has expired");
    }

    const updatedUser = await transaction.user.updateMany({
      where: { id: userId, isActive: true },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: now
      }
    });

    if (updatedUser.count !== 1) {
      throw new HttpError(400, "Reset session is invalid or has expired");
    }

    await transaction.passwordResetOtp.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: now }
    });
  });

  return { message: "Password reset successfully. Please sign in with your new password." };
}
