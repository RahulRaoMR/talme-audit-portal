# Risk Assessment Register

## Architecture assessment before implementation

Checkpoint `192d1cc` was pushed to `origin/main` before Risk Assessment edits.
The application is a React/Vite/Tailwind client with an Express/Zod API,
Prisma 5 and Postgres on Neon. JWT authentication, password-change guards,
five roles, employees, departments, scoped Internal Audit/CAPA access,
Multer uploads and activity history already work. No Risk Register exists.

Reuse the existing directory, authentication, scoped audit access, counter,
attachment table/storage and history table. Add only risk records and a small
versioned scoring configuration. Add risk context to shared evidence/history,
keeping existing report/audit contexts valid. Use additive migrations, test in
an isolated schema, then verify live record preservation. No Legal or Training
implementation belongs in this change.

## Scoring and workflow decisions

Likelihood and severity use integer scales 1–5. The API calculates scores;
clients cannot supply them. Default inclusive bands are Low 1–4, Medium 5–9,
High 10–16, Critical 17–25. Administrators can configure labels, colours and
contiguous bands covering all scores. Levels are derived from the current
configuration, so filters and dashboards remain consistent after configuration
changes without rewriting historical assessments. Configuration changes are
recorded in the existing activity history.

Statuses: Open, Mitigation In Progress, Mitigated, Accepted and Closed.
Employees can update only assigned mitigation details and progress. Managers
manage their department; administrators manage all risks. Auditors read risks
linked to audits/findings they can access and may create a risk directly from
a finding they manage. Closure/acceptance and reviews require a manager/admin,
a comment and residual assessment. Closed records require reasoned reopening
before editing. Mitigated risks require actual completion and residual scores.

The implementation and final verification results are recorded below.

## 1. Existing functionality reused

- JWT, active-account and temporary-password guards; the existing five roles.
- Employee/Department/User records and relationship-based audit access.
- `AuditCounter` for atomic `RISK-YYYY-NNNN` references.
- `MonthlyReportAttachment`, the existing Multer size/type limits and local
  storage directory, and authenticated downloads.
- `MonthlyReportActionHistory`, actor attribution, timestamps, comments and
  previous/new statuses. No replacement history/attachment tables were added.
- Shared fields, badges, pagination, dashboard distributions, API client,
  layout, sidebar and protected routes. No package dependencies were added.

## 2. New Risk Assessment features

Risk identification includes title, description, process/activity, category,
hazard/source, potential consequence, existing controls, department and owner.
The record stores mitigation/control, target/actual completion dates, inherent
and residual likelihood/severity/scores, status, review date, comments,
creator/timestamps, review/closure metadata and authenticated evidence.

Register search covers reference, title, description, process, category and
hazard. Filters compose for department, owner, level, status, review-date range,
overdue mitigation, review due, audit, finding and CAPA. Pagination includes real
totals. Due/overdue calculations use the Indian business date; completed,
accepted and closed mitigations are not flagged as outstanding. Accepted risks
remain open for scheduled reviews. Closed risks require reasoned reopening.

Dashboard: Total, Critical, High and Open Risks, Overdue Mitigations, Risks Due
for Review, department/category distributions and six-month new-assessment
trend. Both register and portal dashboard use scoped persisted records.

Scoring settings have version checks and shared history. Levels are derived
from the current bands while original numeric assessments remain stored. Score,
mitigation, owner, status, review and closure changes have history entries.
Stale edits and simultaneous decisions return 409 instead of overwriting.

## 3. Database changes

Migration `20261030140000_risk_assessment` is additive. New tables:
`RiskAssessment`, `RiskScoringConfiguration`. Shared evidence gains `riskId`;
shared history gains `riskId` and `riskConfigurationId`. Existing related models
gain back-relations only; the history action enum gains risk events.

Foreign keys are indexed. Database checks protect score multiplication, valid
factor ranges, paired residual factors, mitigation dates, source context,
completion/acceptance/closure metadata and exclusive evidence/history contexts.
New tables have RLS enabled and PUBLIC/API-role grants revoked. Runtime access
continues through the authenticated/scoped Express API, not browser database
credentials. Existing audit/report rows retain their original valid contexts.

## 4. Routes and pages

Frontend: `/risks`, `/risks/new`, `/risks/:id`, `/risks/:id/edit`,
`/risks/configuration`. Navigation, dashboard, Compliance Documents, audit detail
and finding/CAPA detail link into the register.

API base `/api/risks`:

- `GET/POST /`, `GET/PATCH /:id`.
- `GET /options`, `/dashboard`, `/configuration`; `PUT /configuration`.
- `POST /from-finding/:findingId`.
- `POST /:id/review`, `/:id/accept`, `/:id/close`, `/:id/reopen`, `/:id/comments`.
- `POST /:id/evidence`, `GET /evidence/:id`.

## 5. Permissions

| Role | Access |
| --- | --- |
| Employee | View assigned risks; update assigned mitigation, completion, residual factors, progress/comments and evidence while open. Cannot change initial scoring/ownership, review, accept or close. |
| Manager | Create/view/manage risks in their own department, assign active department employees, review, accept, close and reopen with reasons. |
| Auditor | Read risks linked to audits/findings they can access; create a linked risk directly from a finding they manage. Cannot manage mitigation or close risks. |
| HR Admin / Super Admin | Full cross-department risk management and scoring configuration. Closure and validation rules still apply. |

Scope applies to list/detail, metrics, links and evidence, not only buttons.
An employee assigned a risk does not automatically receive access to its parent
audit/finding/CAPA. Inaccessible parent summaries/links are withheld.

## 6. Audit/CAPA integration

Each risk can link to an audit, finding and CAPA, in addition to its department.
Selecting a finding derives the parent audit; a CAPA must belong to that finding.
The finding entry point prefills its original observation, department and linked
records for review before saving. Multiple risks may relate to one finding.

Audit detail lists related risks; finding/CAPA detail lists related risks and
offers authorised creation. Existing audit access rules validate selected source
records. Risk acceptance/closure does not silently close or alter a finding or
CAPA; their verification workflow remains independent.

## 7. Verification

Commands: `npm run typecheck`, `npm run build`,
`npm run test --workspace server`, `npm run test:all-api --workspace server`.
The API harness creates an owned isolated schema, applies migrations, seeds it,
runs the existing audit workflow and new risk workflow, and removes its schema
and evidence. Browser checks use `npm run test:risk-ui --workspace server` with
the built API and frontend preview running on ports 4000/5173; temporary
persisted risk fixtures, evidence and account are removed afterward.

`verify-risk-deployment.ts` fingerprints all 25 pre-existing tables before and
after applying the migration. Only counts and pass/fail preservation results are
saved; records and secrets are not exported.

Final results:

| Check | Result |
| --- | --- |
| TypeScript, client/server | Passed |
| Frontend/backend production build | Passed; 1,952 frontend modules transformed |
| Existing and risk unit tests | 47 passed, 0 failed (37 existing + 10 risk) |
| Existing Audit/CAPA API suite | 99 checks passed |
| New Risk Assessment API suite | 132 checks passed |
| All six migrations in isolated schema | Passed; temporary schema removed |
| Live additive risk migration | Passed |
| Existing record fingerprints | All 25 original application tables unchanged across migration |
| Browser workflow | Create/edit, factors, mitigation, residual score, evidence, review, close/reopen, configuration, dashboard and finding entry passed in Edge |
| Responsive layout | Desktop/mobile body overflow checks passed; screenshots visually reviewed |
| Live schema check | Database connected; all tables/columns and existing seed/admin records available |
| Browser cleanup | Temporary risks, evidence, account and owned counter removed; original table counts match |

Representative command output:

```text
PASS: 99 API checks; existing monthly and quarterly report endpoints remain available.
PASS: 132 Risk Assessment checks against the running API in an isolated schema.
PASS: isolated migration and requested API verification.
PASS: Risk Assessment migration deployed; records in all 25 existing tables are unchanged.
```

Saved proof: `verification/risk-database-validation.json`. The live register has
zero test/example risks. Imported audit `AUD-2026-0001` remains Draft with all
11 findings. Screenshots under `verification/risk-*.jpg` show temporary persisted
test records before cleanup, not seeded production examples. API/browser output
logs are available locally in the same directory (logs are Git-ignored).

Initial attempts: Prisma generation hit a Windows DLL lock from a running dev
server; releasing the project process resolved it. The first constraint probe
used an unqualified raw table name and hit the public schema; schema qualification
fixed the test harness, and the entire combined API suite passed. A duplicate
preview launch encountered already-used ports; the existing healthy portal
instance was used for browser verification. It remains running; the isolated
test API and browser processes were closed. No build/test failures remain.

There is no lint command/configuration in the repository. No lint result is
claimed. No additional package dependency was introduced.

## 8. Remaining work and scope limits

Legal Register and Training modules were not implemented in this change.
Training Effectiveness, Management Review and the Organisation Chart register
also remain outside scope. Risk evidence continues to use the portal's existing
local authenticated storage, so managed storage is still needed for ephemeral
or multiple application servers. Review/overdue metrics are computed on access;
no background risk email scheduler was added. A risk-specific Excel/PDF export
and bulk spreadsheet import were not requested and are not included.

The organisation should confirm the initial scale labels, category vocabulary,
level thresholds and review policy. No example risks are seeded into the live
register; all demonstration records belong to temporary verification fixtures.

## Git handover

The requested pre-change checkpoint `192d1ccd200f25965c1ccc3de0df4aafd8128cd3`
is committed and pushed to the existing `origin/main` repository. The Risk
Assessment changes remain in the working tree for review: schema/migration,
risk rules/schemas/service/router, typed frontend service, shared UI/components,
five routes, integration links/dashboard/navigation, verification scripts,
tests, screenshots, README and this report. Existing working modules and
credentials remain in their existing locations; credential files stay ignored.
