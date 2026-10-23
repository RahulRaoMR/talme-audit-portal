import type { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import type { ChangePasswordInput, LoginInput } from "../utils/authSchemas.js";
import { HttpError } from "../utils/httpError.js";

const passwordSaltRounds = 12;

type UserProfile = {
  id: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  role: {
    id: string;
    name: string;
    description: string | null;
  };
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
    designation: string;
    department: {
      id: string;
      name: string;
      code: string;
    };
  } | null;
};

const userSelect = {
  id: true,
  email: true,
  isActive: true,
  mustChangePassword: true,
  passwordChangedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: {
    select: {
      id: true,
      name: true,
      description: true
    }
  },
  employee: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      email: true,
      designation: true,
      department: {
        select: {
          id: true,
          name: true,
          code: true
        }
      }
    }
  }
} satisfies Prisma.UserSelect;

function signAccessToken(user: { id: string; email: string; role: { name: string } }) {
  return jwt.sign(
    {
      email: user.email,
      roleName: user.role.name
    },
    env.jwtSecret,
    {
      subject: user.id,
      expiresIn: "1d"
    }
  );
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: {
      role: true
    }
  });

  if (!user || !user.isActive) {
    throw new HttpError(401, "Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new HttpError(401, "Invalid email or password");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  const token = signAccessToken(user);
  const profile = await getUserProfile(user.id);

  return { token, user: profile };
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  return user;
}

export async function changeUserPassword(userId: string, input: ChangePasswordInput) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: { id: true, passwordHash: true }
  });

  if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
    throw new HttpError(400, "Current password is incorrect");
  }

  if (await bcrypt.compare(input.newPassword, user.passwordHash)) {
    throw new HttpError(400, "New password must be different from the current password");
  }

  const now = new Date();
  const passwordHash = await bcrypt.hash(input.newPassword, passwordSaltRounds);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: now
    }
  });

  return { message: "Password changed successfully" };
}
