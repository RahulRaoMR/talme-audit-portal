# Internal Audit and CAPA assessment

Source: `TELME _LA_CAPA_Template_Ver2.xlsx`, Instructions and CAPA Template worksheets, and the supplied implementation requirements.

## Before implementation

| Area | Existing state | Reuse / required change |
| --- | --- | --- |
| Identity, employees, departments, reporting managers | Implemented | Existing User, Role, Employee and Department relationships and RBAC |
| Monthly and quarterly reports, KPI reviews | Implemented | Preserve existing routes, data and review workflows |
| Evidence | Monthly-report uploads/downloads implemented | Extend the existing attachment table and upload storage to audit contexts |
| Activity history | Monthly and quarterly history implemented | Extend monthly activity history with audit context and previous/new status |
| Dashboard and sidebar | Internal Audit placeholder | Replace audit placeholders with authorized database-backed summaries and routes |
| Internal Audit, findings, RCA, CAPA, verification | Missing | New related domain tables, validated transitions and pages |
| Notifications | Missing; SMTP exists for password resets | In-app notifications and due-date events; preserve password reset email |
| Audit exports and reference documents | Missing | Original downloadable workbook, registers and printable summaries |
| Legal Register, Risk Assessment, Training Register, Training Effectiveness, Management Review, Responsibility Matrix | Missing | Document gaps and provide future source links; do not invent those modules |

The workbook contains 11 findings (4 Major NC, 6 Minor NC and 1 OFI). The user requested importing all of them into a draft audit. Its original audit date, action owners and CAPA plans are not supplied and must be confirmed in the portal. Workbook statements are imported as source findings, not as verified current compliance conclusions.

## Architecture

Keep React/Vite, Express, Prisma 5 and Neon PostgreSQL. Retain existing authentication and role names. Use indexed foreign keys, backend-only access with RLS, atomic reference counters, transactional status/history changes, calculated overdue indicators, and authenticated file downloads. Existing report records must retain their original behavior.
