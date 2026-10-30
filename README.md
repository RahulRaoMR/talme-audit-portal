# TALME Employee Audit Portal

Internal employee performance, reporting, and audit portal for Talme Technologies.

The portal includes authentication, employee management, reporting-manager hierarchy, monthly and quarterly reports, configurable KPI scoring, HR finalization, Internal Audit and CAPA workflows, evidence review, in-app notifications, and audit reporting. Attendance and company-wide ranking are not implemented yet.

## Internal Audit and CAPA

The supplied `TELME _LA_CAPA_Template_Ver2.xlsx` is available under **Compliance
Documents**. Its 11 observations can be imported idempotently into a draft audit.
Confirm the imported audit's date, scope, department, auditor and responsible
people before scheduling and issuing findings.

Workflow: **Audit → Finding → RCA → Containment / Corrective / Preventive actions
→ Evidence → Auditor verification → Finding closure → Audit closure**.

- Auditors and administrators create audits, manage findings and review CAPAs.
- Assigned employees prepare RCA/CAPA and complete owned action items.
- Managers view their department's work and add review comments.
- Verification requires accepted evidence and verified actions; users cannot
  verify their own preparation or actions. Administrators can reopen with a reason.
- Overdue/ageing values are calculated using the Indian business date. Preparation
  is due 14 days after findings are issued; implementation supports 30/60/90 days
  or a custom target.
- **Reports & Analytics** exports genuine `.xlsx` registers. Audit details support
  **Print / Save PDF**. Exports respect the requesting user's access.
- Notifications are in-app, including assignment/review events and due-date alerts.
  Background email reminders are not enabled; existing password-reset SMTP is
  preserved.

Apply the additive migration with `npm run prisma:deploy --workspace server`
after generating Prisma Client. Do not reset an existing database. See
`docs/audit-capa-assessment.md` and `docs/audit-capa-implementation.md` for the
assessment, routes, permissions, validation results and remaining compliance gaps.

`npm run test --workspace server` includes audit rule/export tests.
`npm run test:audit-api --workspace server` creates an isolated verification
schema, applies migrations and seeds there, exercises the full workflow, then
removes its temporary schema and evidence. It does not use the live public
register as a fixture database. Optional `test:audit-ui` verifies the running
portal using a temporary account and an isolated local Edge profile on Windows.

## Project Structure

```text
client/   React, Vite, TypeScript, Tailwind CSS frontend
server/   Node.js, Express, TypeScript, Prisma backend
```

## Required Software

- Node.js 20+
- npm 10+
- PostgreSQL 14+

## Install Frontend Dependencies

```bash
npm install --workspace client
```

## Install Backend Dependencies

```bash
npm install --workspace server
```

Or install all workspaces from the repository root:

```bash
npm install
```

## Configure Neon PostgreSQL

This project uses pooled Neon PostgreSQL for application queries and a direct
connection for Prisma migrations. The existing Express backend and Prisma
driver handle database access; credentials stay on the backend.

## Environment Variables

Copy the example files:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

In the Neon Console, open **TALME Employee Audit Portal**, click **Connect**, and
select the **production** branch. Copy the connection string with **Connection
pooling** enabled, then copy it again with pooling disabled. Create `.env.local`
in the repository root (beside `package.json`) and add the two complete URLs:

```env
DATABASE_URL="postgresql://USER:PASSWORD@YOUR_ENDPOINT-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://USER:PASSWORD@YOUR_ENDPOINT.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

Alternatively, `neon deploy` pulls both URLs into this root file once the CLI is
linked to your project. The server, seed, diagnostics, and Prisma command
wrapper load the same files in this order: root `.env.local`, root `.env`, then
`server/.env`. Existing process environment variables take precedence. A legacy
`DIRECT_URL` is used only if `DATABASE_URL_UNPOOLED` is absent.

Keep backend application settings in `server/.env`:

```env
JWT_SECRET="replace-with-a-long-random-secret"
PASSWORD_RESET_JWT_SECRET="replace-with-a-different-long-random-secret"
PASSWORD_RESET_OTP_SECRET="replace-with-another-long-random-secret"
PORT=4000
CLIENT_ORIGINS="http://localhost:5173,http://localhost:5174"

SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-smtp-user"
SMTP_PASS="your-smtp-password"
SMTP_FROM="Talme Technologies <no-reply@talme.com>"
```

Replace all three JWT/OTP secret placeholders with different random values.
Run this command separately for each secret:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Set the frontend API URL in `client/.env`:

```env
VITE_API_URL="http://localhost:4000/api"
```

Do not commit real secrets or passwords.

For SMTP port `587`, keep `SMTP_SECURE=false` so the connection upgrades with
STARTTLS. For SMTP port `465`, set `SMTP_SECURE=true`. Use the credentials and
verified sender supplied by your email provider.

## Initialize a Fresh Neon Database

The Express API and Prisma schema are already implemented. Your Neon
project supplies the PostgreSQL database; the following commands
create the portal tables and initial records. From the repository root, run:

```bash
npm run db:setup
npm run db:admin
npm start
```

`db:setup` generates Prisma Client, verifies the application connection, applies
the checked-in migrations with `prisma migrate deploy`, seeds departments,
roles, KPI templates and rating ranges, then checks the schema and seed data.
The migration permission statements support Neon without requiring Supabase's
`anon` and `authenticated` roles. Row Level Security remains enabled and public
table privileges are revoked. No database reset is performed.

`db:admin` creates the first `admin@talme.com` administrator and prints its
generated temporary password in your terminal. Save it and change it at the
first login. If a super administrator already exists, the command leaves the
account and password unchanged.

Run `npm run db:check` at any time for a read-only connection, schema, seed and
administrator check. It does not print database passwords or employee records.
After setup, run `npm run build` to verify both workspaces, then `npm start`.
With the portal running, `npm run db:verify` exercises the frontend, live Neon
health check, login and password changes, employee writes and persisted reads,
and reporting queries. It creates temporary test accounts and removes them
after verification.

Use this initialization workflow for a new database. If a database was already
initialized manually through SQL Editor, follow the existing migration guidance
below; its migration history must be reconciled before using `prisma migrate
deploy`. Do not reset it or force a schema push.

## Legacy Supabase Databases

The permission sections of the four original migrations were adapted for a
fresh Neon database. Do not replay them or change recorded checksums on a
database that already applied the older files. Reconcile that database's
migration history before using this workflow. The SQL Editor guidance below
applies only to older Supabase installations, not the new Neon project.

## Apply the Employee Password Migration (Legacy Supabase Only)

Until the session pooler on port `5432` is available, apply this file once in
Supabase SQL Editor instead of running Prisma Migrate:

```text
server/prisma/migrations/20260929170000_employee_password_change/migration.sql
```

It adds `User.mustChangePassword` and `User.passwordChangedAt`, then protects
employee tables from direct `anon` and `authenticated` Data API access. Do not run
`prisma migrate dev`, `prisma migrate reset`, or a forced `db push` against the
manually initialized database.

## Run Seed Data

```bash
npm run prisma:seed --workspace server
```

The seed creates the initial departments and roles:

- HR
- Developers
- Payroll
- EMPLOYEE
- MANAGER
- HR_ADMIN
- AUDITOR
- SUPER_ADMIN

## Apply the Monthly Reports Migration

Because the session pooler on port `5432` is unavailable, apply this file once
through Supabase SQL Editor:

```text
server/prisma/migrations/20260929210000_monthly_reports/migration.sql
```

This migration creates only the monthly report tables, enums, indexes, and
foreign keys. It also enables RLS and prevents direct `anon` and `authenticated`
access. Do not run Prisma Migrate or a forced database push after applying it
manually.

## Apply the Quarterly and KPI Migration

Apply this file once through Supabase SQL Editor after the monthly-report
migration:

```text
server/prisma/migrations/20260930110000_quarterly_kpi_framework/migration.sql
```

It adds the quarterly reports, KPI snapshots, rating ranges, action history,
indexes, validation constraints, and backend-only RLS configuration. It does
not alter or delete existing employee or monthly-report records. After the SQL
succeeds, run the seed again to add the initial editable KPI templates and
rating ranges:

```bash
npm run prisma:seed --workspace server
```

Uploaded report files are kept in `server/uploads/monthly-reports` during local
development and are served only through authenticated API routes. Use managed
object storage before deploying multiple backend instances or ephemeral hosts.

## Start Backend

```bash
npm run dev --workspace server
```

The API runs at `http://localhost:4000` by default.

## Start Frontend

```bash
npm run dev --workspace client
```

The frontend runs at `http://localhost:5173` by default.

## API Endpoints

- `POST /api/auth/login`
- `POST /api/auth/change-password`
- `POST /api/auth/forgot-password`
- `POST /api/auth/resend-reset-otp`
- `POST /api/auth/verify-reset-otp`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`
- `GET /api/employees`
- `GET /api/employees/options`
- `GET /api/employees/:id`
- `POST /api/employees`
- `PATCH /api/employees/:id`
- `PATCH /api/employees/:id/status`
- `GET /api/monthly-reports`
- `GET /api/monthly-reports/current`
- `GET /api/monthly-reports/:id`
- `POST /api/monthly-reports`
- `PATCH /api/monthly-reports/:id`
- `POST /api/monthly-reports/:id/submit`
- `POST /api/monthly-reports/:id/approve`
- `POST /api/monthly-reports/:id/return`
- `POST /api/monthly-reports/:id/attachments`
- `GET /api/monthly-reports/:id/attachments/:attachmentId`
- `DELETE /api/monthly-reports/:id/attachments/:attachmentId`
- `GET /api/quarterly-reports`
- `GET /api/quarterly-reports/current`
- `GET /api/quarterly-reports/preview`
- `GET /api/quarterly-reports/:id`
- `POST /api/quarterly-reports`
- `PATCH /api/quarterly-reports/:id`
- `POST /api/quarterly-reports/:id/submit`
- `POST /api/quarterly-reports/:id/return`
- `POST /api/quarterly-reports/:id/manager-review/save`
- `POST /api/quarterly-reports/:id/manager-review`
- `POST /api/quarterly-reports/:id/finalize`
- `GET /api/kpis`
- `GET /api/kpis/:id`
- `POST /api/kpis`
- `PATCH /api/kpis/:id`
- `PATCH /api/kpis/:id/status`
- `GET /api/performance-rating-ranges`
- `POST /api/performance-rating-ranges`
- `PATCH /api/performance-rating-ranges/:id`

Employee endpoints require an authenticated `SUPER_ADMIN` or `HR_ADMIN` whose
temporary password has already been changed. Normal employee creation cannot
assign the `SUPER_ADMIN` role.
