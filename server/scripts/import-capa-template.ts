import "../src/config/loadEnv.js";
import { prisma } from "../src/config/prisma.js";
import { importTemplate } from "../src/services/audit.service.js";
import { roleNames, type RoleName } from "../src/types/auth.js";

try {
  const email = process.env.IMPORT_ADMIN_EMAIL ?? "admin@talme.com";
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, email: true, mustChangePassword: true, role: { select: { name: true } } } });
  if (!(roleNames as readonly string[]).includes(user.role.name)) throw new Error("Unknown operator role");
  const audit = await importTemplate({ userId: user.id, email: user.email, roleName: user.role.name as RoleName, mustChangePassword: user.mustChangePassword });
  console.log(JSON.stringify({ reference: audit.reference, status: audit.status, findings: audit.findings.length, ratings: audit.stats.byRating, auditDate: audit.auditDate, unassignedOwners: audit.findings.filter((finding) => !finding.responsibleEmployeeId).length, sourceDocument: audit.sourceDocument }));
} catch (error) {
  console.error(error instanceof Error && error.name === "HttpError" ? error.message : "Workbook import failed. Confirm the database migration and operator account.");
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
