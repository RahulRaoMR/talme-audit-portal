import "../src/config/loadEnv.js";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "node:net";
import bcrypt from "bcrypt";
import { prisma } from "../src/config/prisma.js";

const frontend = "http://localhost:5173";
const executable = process.env.BROWSER_EXECUTABLE ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const tag = randomBytes(5).toString("hex"); const password = `Preview1!${randomBytes(12).toString("hex")}`;
const email = `audit-preview-${tag}@example.invalid`;
const profile = await mkdtemp(path.join(os.tmpdir(), "talme-audit-preview-"));
const artifacts = path.resolve("../docs/verification"); await mkdir(artifacts, { recursive: true });
let fixture: { id: string; employeeId: string | null } | undefined;
let socket: WebSocket | undefined;
const probe = createServer(); await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve)); const debugAddress = probe.address(); assert.ok(debugAddress && typeof debugAddress !== "string"); const debugPort = debugAddress.port; await new Promise<void>((resolve) => probe.close(() => resolve()));
const browser = spawn(executable, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
browser.on("error", () => undefined);
let sequence = 0;
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
function send(method: string, params: Record<string, unknown> = {}): Promise<any> {
  const id = ++sequence;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); socket!.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); } }, 30000).unref(); });
}
async function evaluate(expression: string) { const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (response.exceptionDetails) throw new Error("Browser evaluation failed"); return response.result?.value; }
async function waitFor(expression: string) { for (let attempt = 0; attempt < 120; attempt++) { if (await evaluate(expression)) return; await delay(250); } throw new Error("Browser page did not reach the expected state"); }
async function navigate(route: string, expected: string) { await send("Page.navigate", { url: `${frontend}${route}` }); await waitFor(`document.body.innerText.includes(${JSON.stringify(expected)})`); await delay(500); }
async function screenshot(name: string) {
  await send("Page.bringToFront");
  try {
    const image = await send("Page.captureScreenshot", { format: "jpeg", quality: 85, fromSurface: true, captureBeyondViewport: false });
    await writeFile(path.join(artifacts, name.replace(/\.png$/, ".jpg")), Buffer.from(image.data, "base64"));
  } catch { console.log(`NOTE: browser screenshot unavailable for ${name}; continuing functional checks.`); }
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) { try { const result = await fetch(`http://127.0.0.1:${debugPort}/json/version`); if (result.ok) { ready = true; break; } } catch {} await delay(250); }
  assert.ok(ready, "Unable to start an isolated Edge browser; set BROWSER_EXECUTABLE if necessary");
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(frontend)}`, { method: "PUT" })).json() as { webSocketDebuggerUrl: string };
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => { socket!.addEventListener("open", () => resolve(), { once: true }); socket!.addEventListener("error", () => reject(new Error("Browser connection failed")), { once: true }); });
  socket.addEventListener("message", (event) => { const message = JSON.parse(String(event.data)); if (!message.id) return; const request = pending.get(message.id); if (!request) return; pending.delete(message.id); if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result); });
  await send("Runtime.enable"); await send("Page.enable"); await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const department = await prisma.department.findUniqueOrThrow({ where: { code: "HR" } });
  fixture = await prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 12), mustChangePassword: false, passwordChangedAt: new Date(), role: { connect: { name: "HR_ADMIN" } }, employee: { create: { email, employeeCode: `UIPREVIEW${tag}`.toUpperCase(), firstName: "Audit", lastName: "Preview", departmentId: department.id, designation: "Temporary interface verification", joiningDate: new Date(), employmentStatus: "ACTIVE" } } }, select: { id: true, employeeId: true } });
  const imported = await prisma.internalAudit.findUniqueOrThrow({ where: { sourceImportKey: "TELME_LA_CAPA_Template_Ver2" }, include: { findings: { orderBy: { reference: "asc" }, take: 1 } } });
  await waitFor("document.readyState === 'complete'");
  const loginOk = await evaluate(`(async () => {const response=await fetch('http://localhost:4000/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:${JSON.stringify(email)},password:${JSON.stringify(password)}})});const result=await response.json();if(response.status!==200)return false;localStorage.setItem('talme_auth_token',result.token);return true;})()`);
  assert.equal(loginOk, true);
  await navigate("/audits", imported.reference); console.log("UI: imported audit register loaded."); await screenshot("audit-register-desktop.png");
  assert.equal(await evaluate("document.body.scrollWidth <= window.innerWidth"), true, "Desktop page must not overflow horizontally");
  await navigate(`/audits/${imported.id}`, imported.reference);
  await evaluate("Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Findings').click()");
  await waitFor(`document.body.innerText.includes(${JSON.stringify(imported.findings[0].reference)})`); console.log("UI: source findings table loaded."); await screenshot("audit-findings-desktop.png");
  await navigate(`/findings/${imported.findings[0].id}`, "Root Cause Analysis and CAPA plan"); console.log("UI: finding and CAPA form loaded."); await screenshot("finding-capa-desktop.png");
  await evaluate("Array.from(document.querySelectorAll('select')).find(select=>Array.from(select.options).some(option=>option.value==='FIVE_WHY')).value='FIVE_WHY';Array.from(document.querySelectorAll('select')).find(select=>Array.from(select.options).some(option=>option.value==='FIVE_WHY')).dispatchEvent(new Event('change',{bubbles:true}))");
  await waitFor("document.body.innerText.includes('Why 5')");
  console.log("UI: 5 Why form, including Why 5, loaded.");
  await navigate("/capas", "CAPA Register"); await waitFor(`document.body.innerText.includes(${JSON.stringify(imported.findings[0].reference)})`);
  await navigate("/compliance-documents", "Original workbook observations");
  await navigate("/audit-reports", "Audit Reports and Exports");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate("/audits", imported.reference); assert.equal(await evaluate("document.body.scrollWidth <= window.innerWidth"), true, "Mobile page must not overflow horizontally"); await screenshot("audit-register-mobile.png");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate(`/audits/${imported.id}`, imported.reference); await send("Emulation.setEmulatedMedia", { media: "print" });
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.audit-print')).display"), "block");
  const pdf = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
  const bytes = Buffer.from(pdf.data, "base64"); assert.equal(bytes.subarray(0, 4).toString(), "%PDF"); await writeFile(path.join(artifacts, "audit-report-preview.pdf"), bytes);
  console.log("PASS: authenticated audit register, finding/CAPA screen, 5 Why form, CAPA register, documents and reporting pages render in Edge.");
  console.log("PASS: desktop/mobile overflow checks and printable PDF report. Screenshots/PDF saved under docs/verification.");
} catch (error) { console.error(error instanceof assert.AssertionError ? error.message : error instanceof Error ? error.message : "Browser verification failed"); process.exitCode = 1; }
finally {
  if (socket?.readyState === WebSocket.OPEN) { socket.send(JSON.stringify({ id: ++sequence, method: "Browser.close" })); await delay(500); socket.close(); }
  if (!browser.killed) browser.kill();
  if (fixture) { await prisma.user.delete({ where: { id: fixture.id } }); if (fixture.employeeId) await prisma.employee.delete({ where: { id: fixture.employeeId } }); }
  await prisma.$disconnect();
  const resolved = path.resolve(profile);
  if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("talme-audit-preview-")) await rm(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 }).catch(() => undefined);
  console.log("CLEANUP: temporary browser/account removed.");
}
