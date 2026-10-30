# Internal Audit and CAPA implementation

## 1. Existing features reused

Existing JWT login, temporary-password requirement, User/Role/Employee/Department
models, manager hierarchy, authentication/role middleware, Zod validation,
Express error handling, React routes, sidebar/header, Tailwind styling and API
client are retained. Monthly and quarterly report routes and KPI functionality
remain available.

Evidence uses the existing Multer storage, size/type limits, authenticated
download pattern and `MonthlyReportAttachment` table. Audit events use the
existing `MonthlyReportActionHistory` table, with audit/finding/CAPA context and
previous/new status. Separate attachment or identity systems were not introduced.

## 2. New functionality

- Audit plans: reference, title, organisation, department, lead auditor, team,
  date, scope, type, location, standard, scheduling, conduct, findings issuance,
  cancellation, guarded closure and administrator reopening.
- Multiple rated RBA findings with automatic references and ownership.
- Standard RCA or structured problem statement, five whys and final root cause.
- CAPA preparation, submission, review/return/resubmission, acceptance,
  implementation, evidence review, verification, closure and reopening.
- Multiple containment/corrective/preventive actions with owner, department,
  planned and actual dates, implementation comments and independent verification.
- PDF/Word/Excel/JPG/PNG evidence at audit, finding, CAPA and action level;
  verification-purpose uploads and acceptance/rejection with comments.
- Calculated preparation and implementation due dates, overdue days, remaining
  days, finding/CAPA ageing, active dashboard cards and distributions.
- Audit register and CAPA register with search, department, auditor, owner,
  rating, status and date filters as appropriate.
- In-app assignment, submission, return, evidence rejection and closure events;
  due/overdue alerts are generated when the notification feed is accessed.
- Genuine XLSX Audit Summary, Finding Register, CAPA Register, Overdue CAPA and
  Department Audit exports, plus browser Print / Save PDF audit reports.
- Original workbook download, its instructions, original observations and an
  idempotent draft import of all 11 rows.

## 3. Database changes

Migration: `20261030100000_internal_audit_capa` (additive).

New tables: `AuditCounter`, `FindingRating`, `InternalAudit`, `AuditTeamMember`,
`AuditFinding`, `Capa`, `CapaActionItem`, `CapaVerification`, `PortalNotification`.

Modified existing tables: `MonthlyReportAttachment` and
`MonthlyReportActionHistory` accept an audit context while preserving monthly
contexts. Existing User, Employee and Department gain Prisma back-relations;
their identities and records are not duplicated.

New tables have RLS enabled and public/API-role privileges revoked. Foreign-key
indexes support scoped access. Constraints protect evidence/history context,
action dates, RCA method and closure metadata. Reference counters are atomic;
important updates use optimistic checks and transactionally record history.
Finding source-row uniqueness prevents repeated workbook imports.
Audit relationship reads explicitly use Prisma 5's `relationJoins` preview
feature, reducing the measured nested finding read from 15 SQL queries to one
(about 0.6 seconds with an active connection). Middleware preserves the original
query strategy for existing report/auth reads. Neon connections receive a
15-second cold-start timeout unless the operator already specified one.

## 4. Pages and API routes

Frontend: `/audits`, `/audits/new`, `/audits/:id`, `/audits/:id/edit`, `/capas`,
`/findings/:id`, `/compliance-documents`, `/audit-reports`, `/notifications`.

API base `/api/audits`:

- `GET/POST /`, `GET/PATCH /:id`, `POST /:id/status`, `POST /:id/findings`,
  `POST /:id/evidence`, `POST /:id/comments`.
- `GET /options`, `/dashboard`, `/reference`, `/template`, `/capas`,
  `/exports/:kind`; `POST /import-template`, `/ratings`.
- `GET/PATCH /findings/:id`, `POST /findings/:id/close`,
  `POST /findings/:id/reopen`.
- `PATCH /capas/:id`, `POST /capas/:id/review`, `POST /capas/:id/actions`,
  `PATCH /actions/:id`.
- `GET /evidence/:id`, `POST /evidence/:id/review`.

Notifications: `GET /api/notifications`, `POST /api/notifications/:id/read`.

## 5. Permissions

| Role | Access |
| --- | --- |
| Employee | Assigned findings/actions; owned CAPA preparation/submission, progress and evidence |
| Manager | Department findings and CAPAs, comments and monitoring; own assignments can be prepared/completed |
| Auditor | Create audits; manage assigned/created/team audits; review/return CAPA, review evidence, verify and close |
| HR Admin / Super Admin | Full visibility and assignment/configuration access; reasoned reopening; same independent verification and closure checks |

Audit detail, dashboard, exports, history and evidence obey server-side scope.
Source workbook downloads are restricted to auditors and administrators because
the document contains company-wide findings. Authentication is unchanged.

## 6. Remaining work and practical limits

The Legal Register, Risk Assessment, Training Register, Training Effectiveness,
Management Review and Organisation Chart/Responsibility Matrix are not
implemented as dedicated registers. Their source needs are visible in Compliance
Documents, and findings support future module/record links.

Email/SMTP reminders and a background scheduler are not enabled; notifications
are in-app. File storage remains the existing local authenticated storage and
needs managed storage for multiple/ephemeral production servers. PDF output uses
the browser's Print / Save PDF, rather than a server-rendered PDF service.
Workbook import targets this supplied template; it is not an arbitrary Excel
mapping/import wizard.

The imported workbook does not supply an original audit date or CAPA owners.
Those must be confirmed by the user; source findings are not automatically
treated as verified current compliance conclusions.

## 7. Validation

TypeScript: both workspaces and API/browser test scripts passed.
Frontend/backend build: passed.
Unit tests: **37 passed, 0 failed** (23 existing, 14 new).
Isolated migration: passed. Full workflow: **99 API checks passed**, including
both RCA methods, return/resubmission, completion, rejected/accepted evidence,
independent action/CAPA verification, finding/audit closure, overdue calculation,
scoped access/exports, notifications, reopening, concurrent decisions and import
idempotence. Existing monthly/quarterly endpoints remained available.

The first API run exceeded its time limit because nested reads expanded into
many SQL round trips; the scoped join optimization resolved this, and the full
run passed. The first browser screenshot run timed out; foreground JPEG capture
and the functional rerun passed.

Browser verification: authenticated pages, 5 Why fields, desktop/mobile overflow
checks and generated printable PDF passed in headless Edge. Artifacts are under
`docs/verification/`.

Main database migration/import: passed. **AUD-2026-0001**, Draft, **11 findings**
(4 Major NC, 6 Minor NC, 1 OFI), 11 unassigned owners, original audit date
unconfirmed. No sample RCA/action/evidence data was added to the live audit.
The final combined CAPA status/view filter was separately verified on the main
register with read-only queries.

Final preservation check: the existing 1 user, 1 employee, 0 monthly reports and
0 quarterly reports match the pre-migration counts. All 25 application tables
have RLS enabled. The saved result is `verification/database-validation.json`.
Temporary test accounts, fixtures and servers were removed/stopped; ports 4000
and 5173 are free for the user's next `npm start`.

`npm run test:audit-api --workspace server` is the repeatable isolated migration
and API test entry point. It creates its own schema instead of modifying the
live register. Browser tests use a temporary account and remove it afterward.
No lint command or lint configuration exists in this repository.

## 8. Git changes

Audit domain schema and one migration; new rules, schemas, service, exports and
router; new API verification script and unit tests; new typed frontend service,
shared audit components and pages; navigation/dashboard integration; original
workbook and extracted source rows; assessment, implementation report and README.
Earlier Neon setup changes remain in the working tree and are not discarded.
