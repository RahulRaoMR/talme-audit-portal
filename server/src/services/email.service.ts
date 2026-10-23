import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";

let transporter: Transporter | null = null;

function getTransporter() {
  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass || !env.smtp.from) {
    throw new Error("SMTP is not configured");
  }

  transporter ??= nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass
    }
  });

  return transporter;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendPasswordResetOtp(input: {
  to: string;
  firstName: string;
  otp: string;
}) {
  const safeFirstName = escapeHtml(input.firstName);
  const subject = "TALME Employee Audit Portal - Password Reset OTP";
  const text = `Hello ${input.firstName},

We received a request to reset your password for the TALME Employee Audit Portal.

Your OTP is: ${input.otp}

This OTP is valid for 10 minutes.

If you did not request this password reset, you can ignore this email.

Regards,
Talme Technologies`;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #172033; line-height: 1.6; max-width: 560px; margin: 0 auto;">
      <h1 style="font-size: 20px; color: #1d3f91;">TALME Employee Audit Portal</h1>
      <p>Hello ${safeFirstName},</p>
      <p>We received a request to reset your password for the TALME Employee Audit Portal.</p>
      <p style="margin: 24px 0 8px;">Your OTP is:</p>
      <p style="font-size: 30px; font-weight: 700; color: #1d3f91; margin: 0 0 24px;">${input.otp}</p>
      <p>This OTP is valid for 10 minutes.</p>
      <p>If you did not request this password reset, you can ignore this email.</p>
      <p style="margin-top: 28px;">Regards,<br />Talme Technologies</p>
    </div>`;

  await getTransporter().sendMail({
    from: env.smtp.from,
    to: input.to,
    subject,
    text,
    html
  });
}
