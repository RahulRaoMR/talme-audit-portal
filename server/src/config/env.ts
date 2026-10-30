import "./loadEnv.js";

const requiredEnv = [
  "DATABASE_URL",
  "JWT_SECRET",
  "PASSWORD_RESET_JWT_SECRET",
  "PASSWORD_RESET_OTP_SECRET"
] as const;

function requireEnv(key: (typeof requiredEnv)[number]) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

for (const key of requiredEnv) {
  requireEnv(key);
}

export const env = {
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtSecret: requireEnv("JWT_SECRET"),
  passwordResetJwtSecret: requireEnv("PASSWORD_RESET_JWT_SECRET"),
  passwordResetOtpSecret: requireEnv("PASSWORD_RESET_OTP_SECRET"),
  port: Number(process.env.PORT ?? 4000),
  clientOrigins: (
    process.env.CLIENT_ORIGINS ?? "http://localhost:5173,http://localhost:5174"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  smtp: {
    host: process.env.SMTP_HOST?.trim() ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER?.trim() ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM?.trim() ?? ""
  }
};
