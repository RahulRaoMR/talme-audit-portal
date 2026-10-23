import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import type { AuthenticatedUser, RoleName } from "../types/auth.js";
import { roleNames } from "../types/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";

type AuthTokenPayload = {
  sub?: unknown;
  email?: unknown;
  roleName?: unknown;
};

function isRoleName(value: string): value is RoleName {
  return roleNames.includes(value as RoleName);
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Authentication token is required");
  }

  const token = header.slice("Bearer ".length);
  const decoded = jwt.verify(token, env.jwtSecret);
  const payload = typeof decoded === "object" && decoded !== null ? (decoded as AuthTokenPayload) : {};

  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.roleName !== "string" ||
    !isRoleName(payload.roleName)
  ) {
    throw new HttpError(401, "Invalid authentication token");
  }

  const user = await prisma.user.findFirst({
    where: {
      id: payload.sub,
      isActive: true
    },
    select: {
      id: true,
      email: true,
      mustChangePassword: true,
      role: {
        select: {
          name: true
        }
      }
    }
  });

  if (!user || !isRoleName(user.role.name)) {
    throw new HttpError(401, "User is not active or no longer exists");
  }

  const authUser: AuthenticatedUser = {
    userId: user.id,
    email: user.email,
    roleName: user.role.name,
    mustChangePassword: user.mustChangePassword
  };

  req.auth = authUser;
  next();
});

export function requireRole(...allowedRoles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(new HttpError(401, "Authentication is required"));
      return;
    }

    if (!allowedRoles.includes(req.auth.roleName)) {
      next(new HttpError(403, "You do not have permission to access this resource"));
      return;
    }

    next();
  };
}

export function requirePasswordChanged(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) {
    next(new HttpError(401, "Authentication is required"));
    return;
  }

  if (req.auth.mustChangePassword) {
    next(new HttpError(403, "Password change is required before accessing this resource"));
    return;
  }

  next();
}
