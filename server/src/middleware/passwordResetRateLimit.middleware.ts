import { rateLimit } from "express-rate-limit";

const rateLimitResponse = {
  message: "Too many password reset requests. Please try again later."
};

export const passwordResetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: rateLimitResponse
});

export const passwordResetVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: rateLimitResponse
});

export const passwordResetCompleteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: rateLimitResponse
});
