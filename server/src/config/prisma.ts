import "./loadEnv.js";
import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

export const prisma = new PrismaClient({ datasources: { db: { url: env.databaseUrl } } });

// Preserve existing report/auth query behavior. Audit reads explicitly opt into
// database joins to avoid many network round trips for the CAPA relationship tree.
prisma.$use(async (parameters, next) => {
  if (parameters.model && ["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany"].includes(parameters.action) && !parameters.args?.relationLoadStrategy) {
    parameters.args = { ...parameters.args, relationLoadStrategy: "query" };
  }
  return next(parameters);
});

