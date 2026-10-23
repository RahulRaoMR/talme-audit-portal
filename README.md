# TALME Employee Audit Portal

Internal employee performance, reporting, and audit portal for Talme Technologies.

The portal includes authentication, employee management, reporting-manager hierarchy, monthly report review, quarterly reports, configurable KPI scoring, and HR finalization. Attendance, company-wide ranking, and the larger internal-audit workflow are intentionally not implemented yet.

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

## Configure Supabase PostgreSQL

This project uses the Supabase transaction-mode pooler for normal application
queries and the session-mode pooler for Prisma migrations.

## Environment Variables

Copy the example files:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Set the backend database URLs in `server/.env`. Prisma and this Express server
load `.env` directly, so the Supabase values belong here rather than in the
frontend's `.env.local` file:

```env
DATABASE_URL="postgresql://postgres.oajvjmtkjzpsairimzaf:[YOUR-PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.oajvjmtkjzpsairimzaf:[YOUR-PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
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

Set the frontend API URL in `client/.env`:

```env
VITE_API_URL="http://localhost:4000/api"
```

Do not commit real secrets or passwords.

For SMTP port `587`, keep `SMTP_SECURE=false` so the connection upgrades with
STARTTLS. For SMTP port `465`, set `SMTP_SECURE=true`. Use the credentials and
verified sender supplied by your email provider.

## Apply the Employee Password Migration

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
