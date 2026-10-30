import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Neon writes secrets at the repository root. Use the same precedence in the
// source server, compiled server, database scripts, and Prisma CLI wrapper.
for (const relativePath of ["../../../.env.local", "../../../.env", "../../.env"]) {
  dotenv.config({ path: fileURLToPath(new URL(relativePath, import.meta.url)) });
}

// Keep older local PostgreSQL configurations usable during the Neon transition.
if (!process.env.DATABASE_URL_UNPOOLED && process.env.DIRECT_URL) {
  process.env.DATABASE_URL_UNPOOLED = process.env.DIRECT_URL;
}

// Neon can need several seconds to wake an idle compute. Respect explicit
// operator settings, and give new connections enough time for that cold start.
for (const key of ["DATABASE_URL", "DATABASE_URL_UNPOOLED"] as const) {
  const value = process.env[key];
  if (!value) continue;
  try {
    const url = new URL(value);
    if (url.hostname.endsWith(".neon.tech") && !url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", "15");
      process.env[key] = url.toString();
    }
  } catch { /* Connection validation reports malformed settings separately. */ }
}
