import "../src/config/loadEnv.js";
import { Prisma, PrismaClient } from "@prisma/client";

class DatabaseSetupError extends Error {}

function connectionUrl(key: "DATABASE_URL" | "DATABASE_URL_UNPOOLED"): URL {
  const value = process.env[key]?.trim();
  if (!value || /PROJECT_REF|YOUR_|REPLACE_WITH|\[[^\]]+\]|<[^>]+>/i.test(value)) {
    throw new DatabaseSetupError(`Set ${key} by running neon deploy from the repository root, or configure it in the root .env.local file.`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DatabaseSetupError(`${key} must be a valid PostgreSQL connection URL with a URL-encoded password.`);
  }

  if (!["postgresql:", "postgres:"].includes(url.protocol) || !url.hostname || !url.username || !url.password) {
    throw new DatabaseSetupError(`${key} must include a PostgreSQL host, username, and password.`);
  }

  return url;
}

async function main() {
  const databaseUrl = connectionUrl("DATABASE_URL");
  const schema = databaseUrl.searchParams.get("schema") || "public";
  const directUrl = connectionUrl("DATABASE_URL_UNPOOLED");
  if (directUrl.hostname.includes("-pooler.")) {
    throw new DatabaseSetupError("DATABASE_URL_UNPOOLED must use the direct Neon hostname without -pooler for migrations.");
  }
  // Bound this diagnostic's pool and connection wait without changing application settings.
  databaseUrl.searchParams.set("connection_limit", "1");
  databaseUrl.searchParams.set("connect_timeout", "15");
  databaseUrl.searchParams.set("pool_timeout", "10");
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl.toString() } } });

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("Database connection succeeded.");
    if (process.argv.includes("--connection-only")) return;

    // Read no employee records. Check that every model's columns are available.
    for (const model of Prisma.dmmf.datamodel.models) {
      const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
      const columns = model.fields
        .filter((field) => field.kind !== "object")
        .map((field) => quote(field.dbName ?? field.name));
      await prisma.$queryRawUnsafe(`SELECT ${columns.join(", ")} FROM ${quote(schema)}.${quote(model.dbName ?? model.name)} LIMIT 0`);
    }
    console.log("All portal tables and columns are available.");

    const [department, role, kpi, rating, admin] = await Promise.all([
      prisma.department.findUnique({ where: { code: "HR" }, select: { id: true } }),
      prisma.role.findUnique({ where: { name: "SUPER_ADMIN" }, select: { id: true } }),
      prisma.kpi.findFirst({ select: { id: true } }),
      prisma.performanceRatingRange.findFirst({ select: { id: true } }),
      prisma.user.findFirst({ where: { role: { name: "SUPER_ADMIN" }, isActive: true }, select: { id: true } })
    ]);

    if (!department || !role || !kpi || !rating) {
      throw new DatabaseSetupError("Portal seed data is missing. Run npm run prisma:seed --workspace server.");
    }
    console.log("Portal seed data is available.");
    console.log(admin ? "An active SUPER_ADMIN account is available." : "Create the first administrator with npm run db:admin from the repository root.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const details = error as { code?: string; errorCode?: string; message?: string; meta?: { code?: string } };
  const code = details?.code ?? details?.errorCode;
  const message = details?.message ?? "";
  if (/tenant.*not found/i.test(message)) {
    console.error("The configured database project could not be found. Run neon deploy to refresh the root .env.local connection settings.");
  } else if (code === "P1000") {
    console.error("Database authentication failed. Run neon deploy to refresh the connection credentials.");
  } else if (["P1001", "P1002", "P1017"].includes(code ?? "")) {
    console.error("Cannot reach the database. Check the Neon project status, connection URL, and network connection.");
  } else if (["P2021", "P2022"].includes(code ?? "") || ["42P01", "42703"].includes(details?.meta?.code ?? "")) {
    console.error("The database is reachable, but the portal schema is incomplete. For a fresh database, run npm run db:setup. For an existing database, follow the migration guidance in README.md.");
  } else if (error instanceof DatabaseSetupError) {
    console.error(error.message);
  } else {
    // Prisma errors can contain connection strings; do not print them verbatim.
    console.error(`Database check failed${code ? ` (${code})` : ""}. Check the root .env.local file and Neon project status.`);
  }
  process.exitCode = 1;
});
