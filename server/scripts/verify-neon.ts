import "../src/config/loadEnv.js";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const apiUrl = process.env.VERIFY_API_URL ?? "http://localhost:4000/api";
const frontendUrl = process.env.VERIFY_FRONTEND_URL ?? "http://localhost:5173";
const runId = randomBytes(8).toString("hex");
const adminEmail = `neon-verify-admin-${runId}@example.invalid`;
const employeeEmail = `neon-verify-employee-${runId}@example.invalid`;
const adminCode = `VERIFYA${runId.toUpperCase()}`;
const employeeCode = `VERIFYE${runId.toUpperCase()}`;
const prisma = new PrismaClient();

async function request(method: string, path: string, status: number, token?: string, body?: unknown) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: frontendUrl,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });
  assert.equal(response.status, status, `${method} ${path}: expected HTTP ${status}, got ${response.status}`);
  assert.equal(response.headers.get("access-control-allow-origin"), frontendUrl, "Frontend CORS origin must be allowed");
  return response.json();
}

async function main() {
  assert.ok(new URL(process.env.DATABASE_URL ?? "").hostname.endsWith(".neon.tech"), "Configure the Neon DATABASE_URL first");
  const frontend = await fetch(frontendUrl, { signal: AbortSignal.timeout(10000) });
  assert.equal(frontend.status, 200);
  assert.match(await frontend.text(), /<div id="root">/);
  console.log("PASS: frontend serves the portal (HTTP 200).");

  const health = await request("GET", "/health", 200);
  assert.equal(health.database, "connected");
  console.log("PASS: running API connects to Neon (HTTP 200).");

  const tables = await prisma.$queryRaw<Array<{ tablename: string; rowsecurity: boolean }>>`
    SELECT tablename, rowsecurity FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'
  `;
  assert.ok(tables.length > 0 && tables.every((table) => table.rowsecurity), "Portal tables must have RLS enabled");
  console.log(`PASS: Row Level Security enabled on all ${tables.length} portal tables.`);

  const [role, department] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: "HR_ADMIN" } }),
    prisma.department.findUniqueOrThrow({ where: { code: "HR" } })
  ]);
  const initialPassword = `Verify1!${randomBytes(16).toString("hex")}`;
  const newPassword = `Verify2!${randomBytes(16).toString("hex")}`;
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(initialPassword, 12),
      role: { connect: { id: role.id } },
      employee: {
        create: {
          employeeCode: adminCode,
          firstName: "Neon",
          lastName: "Verification",
          email: adminEmail,
          department: { connect: { id: department.id } },
          designation: "Temporary database verification",
          joiningDate: new Date(),
          employmentStatus: "ACTIVE"
        }
      }
    },
    select: { id: true }
  });

  await request("GET", "/employees", 401);
  const firstLogin = await request("POST", "/auth/login", 200, undefined, { email: adminEmail, password: initialPassword });
  await request("GET", "/employees", 403, firstLogin.token);
  await request("POST", "/auth/change-password", 200, firstLogin.token, {
    currentPassword: initialPassword,
    newPassword,
    confirmPassword: newPassword
  });
  const login = await request("POST", "/auth/login", 200, undefined, { email: adminEmail, password: newPassword });
  const token: string = login.token;
  const profile = await request("GET", "/auth/me", 200, token);
  assert.equal(profile.user.id, admin.id);
  assert.equal(profile.user.mustChangePassword, false);
  console.log("PASS: login, required password change, re-login, profile and access controls.");

  await request("GET", "/employees/options", 200, token);
  const created = await request("POST", "/employees", 201, token, {
    employeeCode,
    email: employeeEmail,
    firstName: "Neon",
    lastName: "Test Employee",
    departmentId: department.id,
    designation: "Verification initial value",
    joiningDate: new Date().toISOString(),
    employmentStatus: "ACTIVE",
    roleName: "EMPLOYEE"
  });
  const employeeId: string = created.employee.id;
  await request("PATCH", `/employees/${employeeId}`, 200, token, { designation: "Verification persisted value" });
  const persisted = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
  assert.equal(persisted.designation, "Verification persisted value");
  const fetched = await request("GET", `/employees/${employeeId}`, 200, token);
  assert.equal(fetched.employee.designation, persisted.designation);
  const list = await request("GET", `/employees?search=${employeeCode}`, 200, token);
  assert.ok(list.employees.some((employee: { id: string }) => employee.id === employeeId));
  await request("PATCH", `/employees/${employeeId}/status`, 200, token, { isActive: false });
  await request("POST", "/auth/login", 401, undefined, { email: employeeEmail, password: created.temporaryPassword });
  await request("PATCH", `/employees/${employeeId}/status`, 200, token, { isActive: true });
  const employeeLogin = await request("POST", "/auth/login", 200, undefined, { email: employeeEmail, password: created.temporaryPassword });
  assert.equal(employeeLogin.user.role.name, "EMPLOYEE");
  console.log("PASS: employee create, update, persisted Neon read, list, activation and login.");

  for (const path of ["/kpis", "/performance-rating-ranges", "/monthly-reports", "/quarterly-reports"]) {
    await request("GET", path, 200, token);
  }
  console.log("PASS: KPI, rating, monthly-report and quarterly-report API queries (HTTP 200).");
}

main()
  .catch((error: unknown) => {
    // Connection strings, account passwords and access tokens must stay private.
    console.error(error instanceof assert.AssertionError ? error.message : "Live Neon verification failed; inspect the local API logs.");
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.user.deleteMany({ where: { email: { in: [adminEmail, employeeEmail] } } });
      await prisma.employee.deleteMany({ where: { employeeCode: { in: [adminCode, employeeCode] } } });
      console.log("CLEANUP: temporary verification accounts removed.");
    } catch {
      console.error("Verification account cleanup failed; check the temporary VERIFY records.");
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  });
