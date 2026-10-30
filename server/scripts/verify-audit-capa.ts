import "../src/config/loadEnv.js";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcrypt";
import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import { monthlyReportUploadDirectory } from "../src/config/monthlyReportUpload.js";
import { addDays, calendarDay } from "../src/utils/auditRules.js";

const tag = randomBytes(5).toString("hex");
if (!new URL(process.env.DATABASE_URL ?? "").searchParams.get("schema")?.startsWith("talme_audit_verify_")) {
  throw new Error("Use npm run test:audit-api --workspace server to create an isolated verification schema.");
}
const password = `Audit1!${randomBytes(12).toString("hex")}`;
const userIds: string[] = []; const employeeIds: string[] = []; const auditIds: string[] = [];
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}/api`;
const today = new Date(calendarDay(new Date()));
const day = (offset: number) => addDays(today, offset).toISOString().slice(0, 10);
let assertions = 0;

async function response(method: string, route: string, token?: string, body?: unknown) {
  return fetch(`${base}${route}`, { method, headers: { Origin: "http://localhost:5173", ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), signal: AbortSignal.timeout(90000) });
}
async function request(method: string, route: string, expected: number, token?: string, body?: unknown) {
  const result = await response(method, route, token, body);
  const payload = await result.json();
  assert.equal(result.status, expected, `${method} ${route}: ${payload.message ?? `HTTP ${result.status}`}`); assertions++;
  return payload;
}
type Actor = { id: string; employeeId: string; token: string; email: string };
async function makeActor(role: string, departmentId: string, ordinal: number): Promise<Actor> {
  const email = `audit-verify-${tag}-${ordinal}@example.invalid`;
  const user = await prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 12), mustChangePassword: false, passwordChangedAt: new Date(), role: { connect: { name: role } }, employee: { create: { employeeCode: `AUDITTEST${tag}${ordinal}`.toUpperCase(), email, firstName: "Audit", lastName: `Verification ${ordinal}`, department: { connect: { id: departmentId } }, designation: "Temporary workflow verification", joiningDate: today, employmentStatus: "ACTIVE" } } }, select: { id: true, employeeId: true } });
  userIds.push(user.id); employeeIds.push(user.employeeId!);
  const login = await request("POST", "/auth/login", 200, undefined, { email, password });
  return { id: user.id, employeeId: user.employeeId!, token: login.token, email };
}

async function main() {
  const hr = await prisma.department.findUniqueOrThrow({ where: { code: "HR" } });
  const dev = await prisma.department.findUniqueOrThrow({ where: { code: "DEV" } });
  const auditor = await makeActor("AUDITOR", hr.id, 1);
  const owner = await makeActor("EMPLOYEE", hr.id, 2);
  const owner2 = await makeActor("EMPLOYEE", hr.id, 3);
  const outsider = await makeActor("EMPLOYEE", dev.id, 4);
  const manager = await makeActor("MANAGER", hr.id, 5);
  const admin = await makeActor("HR_ADMIN", hr.id, 6);
  const unassignedAuditor = await makeActor("AUDITOR", dev.id, 7);
  await request("GET", "/audits", 401);
  const input = { title: `Workflow verification ${tag}`, organisation: "Temporary verification", departmentId: hr.id, auditorId: auditor.id, auditDate: day(-10), scope: "End-to-end verification of internal audit and CAPA", auditType: "INTERNAL", location: "Verification", standardReference: "RBA", teamMemberIds: [] };
  await request("POST", "/audits", 403, owner.token, input);
  let audit = (await request("POST", "/audits", 201, auditor.token, input)).audit;
  auditIds.push(audit.id);
  assert.match(audit.reference, /^AUD-\d{4}-\d{4,}$/);
  await request("GET", `/audits/${audit.id}`, 404, outsider.token);
  await request("GET", `/audits/${audit.id}`, 404, unassignedAuditor.token);
  const findingInput = { rbaSection: "AM", rbaReference: "AM4.3", ratingCode: "MAJOR_NC", description: "Temporary verification finding", departmentId: hr.id, responsibleEmployeeId: owner.employeeId };
  const finding = (await request("POST", `/audits/${audit.id}/findings`, 201, auditor.token, findingInput)).finding;
  const second = (await request("POST", `/audits/${audit.id}/findings`, 201, auditor.token, { ...findingInput, description: "Independent second finding", responsibleEmployeeId: owner2.employeeId })).finding;
  assert.equal(finding.reference, `${audit.reference}-F01`); assert.equal(second.reference, `${audit.reference}-F02`);
  const ownAudit = (await request("GET", `/audits/${audit.id}`, 200, owner.token)).audit;
  assert.equal(ownAudit.findings.length, 1); assert.equal(ownAudit.findings[0].id, finding.id);
  await request("GET", `/audits/findings/${second.id}`, 404, owner.token);
  await request("GET", `/audits/findings/${finding.id}`, 200, manager.token);
  await request("PATCH", `/audits/capas/${finding.capa.id}`, 403, manager.token, { rootCause: "Unauthorized change" });
  console.log("PASS: audit creation, multiple finding references, department visibility and assignment-based access.");
  for (const status of ["SCHEDULED", "IN_PROGRESS", "AUDIT_COMPLETED", "FINDINGS_ISSUED", "CAPA_PENDING"]) audit = (await request("POST", `/audits/${audit.id}/status`, 200, auditor.token, { status, comment: "Verification stage" })).audit;
  await request("POST", `/audits/${audit.id}/status`, 409, auditor.token, { status: "CLOSED", comment: "Must reject closure with open findings" });
  await request("POST", `/audits/findings/${finding.id}/close`, 409, auditor.token, { comment: "Must reject unverified closure" });

  async function completeFinding(initial: typeof finding, responsible: Actor, extended: boolean) {
    const capaId = initial.capa.id;
    if (extended) await request("POST", `/audits/capas/${capaId}/review`, 400, responsible.token, { decision: "SUBMIT" });
    const rca = extended ? { rcaMethod: "FIVE_WHY", problemStatement: "Missing document controls", why1: "No check", why2: "No checklist", why3: "No owner", why4: "No assignment process", why5: "No review responsibility", finalRootCause: "Ownership not established" } : { rcaMethod: "STANDARD", rootCause: "Missing independent document control" };
    let current = (await request("PATCH", `/audits/capas/${capaId}`, 200, responsible.token, { ...rca, containmentAction: "Check all open documents immediately", correctiveAction: "Review existing documents", preventiveAction: "Introduce a controlled checklist", dateEstablished: day(-7), startDate: day(-7), implementationDays: 30 })).finding;
    assert.equal(current.capa.targetDate.slice(0, 10), day(23));
    current = (await request("PATCH", `/audits/capas/${capaId}`, 200, responsible.token, { targetDate: day(-1), implementationDays: null, expectedUpdatedAt: current.capa.updatedAt })).finding;
    assert.equal(current.capa.metrics.isOverdue, true);
    for (const actionType of ["CORRECTIVE", "PREVENTIVE"]) current = (await request("POST", `/audits/capas/${capaId}/actions`, 201, responsible.token, { actionType, description: `${actionType} test action`, ownerEmployeeId: responsible.employeeId, departmentId: hr.id, startDate: day(-7), targetDate: day(-1) })).finding;
    const actions = current.capa.actions as Array<{ id: string }>;
    await request("PATCH", `/audits/actions/${actions[0].id}`, 400, responsible.token, { status: "COMPLETED", completionDate: day(-8) });
    await request("PATCH", `/audits/actions/${actions[0].id}`, 409, responsible.token, { status: "COMPLETED", completionDate: day(0) });
    await request("POST", `/audits/capas/${capaId}/review`, 200, responsible.token, { decision: "SUBMIT", comment: "Plan ready" });
    if (extended) {
      await request("POST", `/audits/capas/${capaId}/review`, 200, auditor.token, { decision: "START_REVIEW" });
      await request("POST", `/audits/capas/${capaId}/review`, 400, auditor.token, { decision: "RETURN", comment: "" });
      await request("POST", `/audits/capas/${capaId}/review`, 200, auditor.token, { decision: "RETURN", comment: "Clarify the ownership process" });
      current = (await request("PATCH", `/audits/capas/${capaId}`, 200, responsible.token, { finalRootCause: "Ownership and approval responsibility not formally established" })).finding;
      await request("POST", `/audits/capas/${capaId}/review`, 200, responsible.token, { decision: "SUBMIT", comment: "Root cause clarified" });
      const simultaneous = await Promise.all([response("POST", `/audits/capas/${capaId}/review`, auditor.token, { decision: "ACCEPT", comment: "Accepted for implementation" }), response("POST", `/audits/capas/${capaId}/review`, auditor.token, { decision: "ACCEPT", comment: "Duplicate decision" })]);
      assert.deepEqual(simultaneous.map((item) => item.status).sort(), [200, 409]); assertions += 2;
    } else await request("POST", `/audits/capas/${capaId}/review`, 200, auditor.token, { decision: "ACCEPT", comment: "Accepted" });
    await request("POST", `/audits/capas/${capaId}/review`, 400, responsible.token, { decision: "REQUEST_VERIFICATION" });
    const data = new FormData(); data.append("findingId", initial.id); data.append("capaId", capaId); data.append("purpose", "VERIFICATION"); data.append("files", new Blob(["%PDF-1.4\nTemporary CAPA verification evidence"], { type: "application/pdf" }), `verification-${tag}.pdf`);
    await request("POST", `/audits/${audit.id}/evidence`, 201, responsible.token, data);
    current = (await request("GET", `/audits/findings/${initial.id}`, 200, responsible.token)).finding;
    const evidence = current.capa.evidence[0]; assert.ok(evidence);
    await request("POST", `/audits/evidence/${evidence.id}/review`, 403, responsible.token, { reviewStatus: "ACCEPTED", comment: "Self approval denied" });
    if (extended) await request("POST", `/audits/evidence/${evidence.id}/review`, 200, auditor.token, { reviewStatus: "REJECTED", comment: "Add proof of checklist rollout" });
    await request("POST", `/audits/evidence/${evidence.id}/review`, 200, auditor.token, { reviewStatus: "ACCEPTED", comment: "Supporting records verified" });
    const downloaded = await response("GET", `/audits/evidence/${evidence.id}`, responsible.token); assert.equal(downloaded.status, 200); assert.match(await downloaded.text(), /Temporary CAPA verification evidence/);
    await request("GET", `/audits/evidence/${evidence.id}`, 404, outsider.token);
    for (const action of actions) {
      await request("PATCH", `/audits/actions/${action.id}`, 200, responsible.token, { status: "COMPLETED", completionDate: day(0), comments: "Implementation completed" });
      await request("PATCH", `/audits/actions/${action.id}`, 403, responsible.token, { status: "VERIFIED", comments: "Self verification denied" });
      await request("PATCH", `/audits/actions/${action.id}`, 200, auditor.token, { status: "VERIFIED", comments: "Action and evidence checked independently" });
    }
    await request("POST", `/audits/capas/${capaId}/review`, 200, responsible.token, { decision: "REQUEST_VERIFICATION" });
    if (extended) { await request("POST", `/audits/capas/${capaId}/review`, 200, auditor.token, { decision: "REJECT_VERIFICATION", comment: "Record the final independent check" }); await request("POST", `/audits/capas/${capaId}/review`, 200, responsible.token, { decision: "REQUEST_VERIFICATION" }); }
    await request("POST", `/audits/capas/${capaId}/review`, 200, auditor.token, { decision: "VERIFY", comment: "Effective implementation verified" });
    current = (await request("POST", `/audits/findings/${initial.id}/close`, 200, auditor.token, { comment: "Finding and CAPA closed after verification" })).finding;
    assert.equal(current.status, "CLOSED"); assert.equal(current.capa.status, "CLOSED"); assert.equal(current.capa.metrics.isOverdue, false);
    await request("PATCH", `/audits/capas/${capaId}`, 409, responsible.token, { rootCause: "Closed record must stay locked" });
  }
  await completeFinding(finding, owner, true);
  await request("POST", `/audits/${audit.id}/status`, 409, auditor.token, { status: "CLOSED", comment: "Second finding still open" });
  await completeFinding(second, owner2, false);
  audit = (await request("POST", `/audits/${audit.id}/status`, 200, auditor.token, { status: "CLOSED", comment: "All findings verified and closed" })).audit;
  assert.equal(audit.status, "CLOSED"); assert.equal(audit.stats.closedCapas, 2);
  assert.ok(audit.history.some((item: { action: string }) => item.action === "CAPA_RETURNED"));
  assert.ok(audit.history.some((item: { action: string }) => item.action === "AUDIT_CLOSED"));
  console.log("PASS: standard and 5 Why RCA, submission, return, resubmission, independent evidence/action verification, finding and audit closure.");
  console.log("PASS: calculated overdue/30-day targets, invalid dates, premature closure, self-review rejection and concurrent-decision protection.");

  const exportResponse = await response("GET", "/audits/exports/capas", owner.token); assert.equal(exportResponse.status, 200); const exportBytes = Buffer.from(await exportResponse.arrayBuffer());
  assert.equal(exportBytes.readUInt32LE(0), 0x04034b50); assert.ok(exportBytes.includes(Buffer.from(finding.reference))); assert.ok(!exportBytes.includes(Buffer.from(second.reference)));
  const original = await response("GET", "/audits/template", auditor.token); assert.equal(original.status, 200);
  const originalBytes = Buffer.from(await original.arrayBuffer()); const localBytes = await readFile(new URL("../resources/TELME_LA_CAPA_Template_Ver2.xlsx", import.meta.url)); assert.equal(createHash("sha256").update(originalBytes).digest("hex"), createHash("sha256").update(localBytes).digest("hex"));
  await request("GET", "/audits/template", 403, owner.token);
  const notifications = await request("GET", "/notifications", 200, owner.token); assert.ok(notifications.notifications.length);
  const notificationId = notifications.notifications[0].id; await request("POST", `/notifications/${notificationId}/read`, 200, owner.token); await request("POST", `/notifications/${notificationId}/read`, 404, outsider.token);
  await request("GET", "/audits/dashboard", 200, manager.token);
  await request("GET", "/monthly-reports", 200, owner.token); await request("GET", "/quarterly-reports", 200, owner.token);
  await request("POST", "/audits/ratings", 403, auditor.token, { code: "TEST_NC", label: "Test", severity: 1 });
  await request("POST", "/audits/ratings", 200, admin.token, { code: `TEST_${tag.toUpperCase()}`, label: "Temporary custom rating", severity: 150 });
  await request("POST", `/audits/${audit.id}/status`, 409, auditor.token, { status: "IN_PROGRESS", comment: "Only administrators reopen" });
  await request("POST", `/audits/${audit.id}/status`, 200, admin.token, { status: "IN_PROGRESS", comment: "Controlled reopening verification" });
  await request("POST", `/audits/findings/${finding.id}/reopen`, 200, admin.token, { comment: "Controlled finding reopening verification" });
  const source = (await request("POST", "/audits/import-template", 201, auditor.token, {})).audit; auditIds.push(source.id);
  assert.equal(source.findings.length, 11); assert.equal(source.auditDate, null); assert.equal(source.status, "DRAFT");
  const repeated = (await request("POST", "/audits/import-template", 201, auditor.token, {})).audit; assert.equal(repeated.id, source.id); assert.equal(repeated.findings.length, 11);
  console.log("PASS: scoped XLSX export, original workbook download, notifications, custom ratings, reopening and idempotent 11-finding draft import.");
  console.log(`PASS: ${assertions} API checks; existing monthly and quarterly report endpoints remain available.`);
}

try { await main(); }
catch (error) { console.error(error instanceof assert.AssertionError ? error.message : error instanceof Error ? `${error.name}: workflow verification failed` : "Workflow verification failed"); process.exitCode = 1; }
finally {
  try {
    const files = await prisma.monthlyReportAttachment.findMany({ where: { auditId: { in: auditIds } }, select: { storedName: true } });
    await prisma.internalAudit.deleteMany({ where: { id: { in: auditIds }, title: { contains: tag } } });
    // Imported source fixtures use a fixed source title and are identified by IDs created by this run.
    await prisma.internalAudit.deleteMany({ where: { createdById: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds }, email: { contains: tag } } });
    await prisma.employee.deleteMany({ where: { id: { in: employeeIds }, email: { contains: tag } } });
    await prisma.findingRating.deleteMany({ where: { code: `TEST_${tag.toUpperCase()}` } });
    await Promise.all(files.map((file) => unlink(path.join(monthlyReportUploadDirectory, file.storedName)).catch(() => undefined)));
    console.log("CLEANUP: this run's temporary audits, users, notifications and evidence removed.");
  } catch { console.error("Workflow fixture cleanup failed; inspect temporary AUDITTEST records."); process.exitCode = 1; }
  await new Promise<void>((resolve) => server.close(() => resolve())); await prisma.$disconnect();
}
