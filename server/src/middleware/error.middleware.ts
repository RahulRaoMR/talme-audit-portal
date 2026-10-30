import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ message: error.errors.map((issue) => issue.message).join(", ") });
    return;
  }
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Each attachment must be 10 MB or smaller"
      : error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE"
        ? "Upload no more than 5 files at a time"
        : error.message;
    res.status(400).json({ message });
    return;
  }

  if (error instanceof Error && error.message.startsWith("Only PDF")) {
    res.status(400).json({ message: error.message });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  if (isPrismaUniqueError(error)) {
    res.status(409).json({ message: "A record with this value already exists" });
    return;
  }

  if (isPrismaConnectionError(error)) {
    console.error("Prisma database connection failed", {
      code: getErrorProperty(error, "code"),
      name: getErrorProperty(error, "name"),
    });
    res.status(503).json({
      message: "Database connection is not configured or is currently unavailable",
    });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Internal server error" });
};

function isPrismaUniqueError(error: unknown): error is { code: "P2002" } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function isPrismaConnectionError(error: unknown): boolean {
  const code = getErrorProperty(error, "code");
  const name = getErrorProperty(error, "name");

  return (
    ["P1000", "P1001", "P1002", "P1013"].includes(code ?? "") ||
    name === "PrismaClientInitializationError"
  );
}

function getErrorProperty(error: unknown, property: "code" | "name"): string | undefined {
  if (typeof error !== "object" || error === null || !(property in error)) {
    return undefined;
  }

  const value = (error as Record<string, unknown>)[property];
  return typeof value === "string" ? value : undefined;
}
