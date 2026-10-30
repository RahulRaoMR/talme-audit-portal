import "../src/config/loadEnv.js";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// Run the workflow against an owned temporary schema, never the live public
// register. Migrations and seed data use the same database role as the app.
const schema = `talme_audit_verify_${Date.now()}_${randomBytes(3).toString("hex")}`;
const cwd = fileURLToPath(new URL("..", import.meta.url));
const childEnv = { ...process.env };
const secrets: string[] = [];
for (const key of ["DATABASE_URL", "DATABASE_URL_UNPOOLED"] as const) {
  const value = process.env[key]; if (!value) throw new Error(`Configure ${key} before running audit verification`);
  const url = new URL(value); url.searchParams.set("schema", schema); childEnv[key] = url.toString();
  secrets.push(value, url.toString(), url.password, decodeURIComponent(url.password));
}
const clean = (line: string) => secrets.reduce((value, secret) => secret ? value.replaceAll(secret, "[REDACTED]") : value, line);
const admin = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_UNPOOLED } } });
let created = false;
async function command(title: string, args: string[]) {
  console.log(`${title}: starting in an isolated schema`);
  const child = spawn(process.execPath, ["../node_modules/tsx/dist/cli.mjs", ...args], { cwd, env: childEnv, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  createInterface({ input: child.stdout! }).on("line", (line) => console.log(clean(line)));
  createInterface({ input: child.stderr! }).on("line", (line) => console.error(clean(line)));
  const timer = setTimeout(() => { console.error(`${title}: exceeded the verification time limit`); child.kill(); }, 900000); timer.unref();
  const status = await new Promise<number | null>((resolve, reject) => { child.once("close", resolve); child.once("error", reject); }); clearTimeout(timer);
  if (status !== 0) throw new Error(`${title} failed`);
}
try {
  if (!/^talme_audit_verify_[a-z0-9_]+$/.test(schema)) throw new Error("Invalid verification schema name");
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`); created = true;
  await command("MIGRATION", ["scripts/prisma.ts", "migrate", "deploy"]);
  await command("SEED", ["prisma/seed.ts"]);
  if (!process.argv.includes("--risk")) await command("AUDIT API", ["scripts/verify-audit-capa.ts"]);
  if (process.argv.includes("--risk") || process.argv.includes("--all")) await command("RISK API", ["scripts/verify-risk.ts"]);
  console.log("PASS: isolated migration and requested API verification.");
} catch (error) { console.error(error instanceof Error ? clean(error.message) : "Audit verification failed"); process.exitCode = 1; }
finally {
  if (created) {
    const fixtures = new PrismaClient({ datasources: { db: { url: childEnv.DATABASE_URL_UNPOOLED } } });
    try {
      const files = await fixtures.monthlyReportAttachment.findMany({ select: { storedName: true } }).catch(() => []);
      const directory = path.resolve(cwd, "uploads", "monthly-reports");
      for (const file of files) { const target = path.resolve(directory, file.storedName); if (target.startsWith(`${directory}${path.sep}`)) await unlink(target).catch(() => undefined); }
    } finally { await fixtures.$disconnect(); }
    try { await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`); console.log("CLEANUP: isolated verification schema removed; live register was not changed."); }
    catch { console.error("Could not remove the temporary verification schema."); process.exitCode = 1; }
  }
  await admin.$disconnect();
}
