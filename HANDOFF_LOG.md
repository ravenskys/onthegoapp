# Handoff Log

This file is the running checkpoint log for the project. New entries should be added to the top with the date, what changed, what was verified, and any open follow-up items.

## 2026-05-04

### Summary
- The technician experience was pushed further into the new staged flow so inspection data now lives inside `/tech/jobs/[jobId]` instead of relying on visible legacy inspection links.
- The staged technician flow now owns:
  - pre-inspection photo capture
  - mini vs full inspection selection
  - tire inspection details
  - full-only brake inspection details
  - maintenance / undercar inspection details
  - saving the inspection record directly into `inspections`
- Old technician inspection entry points were redirected back into the staged flow instead of leaving users in the legacy worksheet.
- Local Supabase/dev troubleshooting showed the real blocker is currently network reachability to the self-hosted public auth endpoint, not the customer login form itself.
- Customer quote e-sign work was started but not finished.

### Completed
- Integrated inspection content into:
  - `src/app/tech/jobs/[jobId]/TechnicianJobFlowPage.tsx`
- Removed visible legacy-tech links from:
  - `src/app/tech/TechnicianHomePage.tsx`
  - `src/app/tech/jobs/page.tsx`
- Redirected legacy inspection routes:
  - `src/app/tech/jobs/[jobId]/inspection/page.tsx` now redirects to `/tech/jobs/[jobId]?stage=inspection`
  - `src/app/tech/inspection/page.tsx` now redirects to `/tech`
- Added staged route support for `?stage=inspection`:
  - `src/app/tech/jobs/[jobId]/page.tsx`
- Added safer Supabase client bootstrap behavior:
  - `src/lib/supabase.ts`
  - uses a URL-specific auth storage key
  - clears broken local auth state if bootstrap fails
- Local `.env.local` was returned to the public Supabase URL so localhost matches the deployed app path again.

### In Progress
- Customer quote approval and e-sign implementation started.
- Added but not finished:
  - `src/app/api/customer/estimates/[estimateId]/route.ts`
  - `supabase/migrations/20260504123000_add_customer_quote_signature_and_line_decisions.sql`
- Service-line delete support for the new technician flow is also still local-only:
  - `src/app/api/internal/tech/job-services/[serviceId]/route.ts`
  - `supabase/migrations/20260504100000_add_job_services_delete_policies.sql`

### Verified
- `npm run typecheck`
- `npm run build` using alternate dist dir when needed during OneDrive lock conflicts
- Targeted lint on changed technician route files
- The staged technician route now builds successfully with:
  - `/tech`
  - `/tech/jobs`
  - `/tech/jobs/[jobId]`
  - redirected `/tech/jobs/[jobId]/inspection`
  - redirected `/tech/inspection`

### Current issues
- Public Supabase auth endpoint appears unreachable from this machine:
  - `https://ravenskys.tail490ef5.ts.net/auth/v1/health` timed out
- Tailscale IP path also appears unreachable from this machine:
  - `http://100.76.54.98:8000/auth/v1/health` timed out
  - `http://100.76.54.98:8088/auth/v1/health` timed out
- Because of that, customer login can still throw `Failed to fetch` even though the form code is not the root cause.
- Local dev also occasionally hits OneDrive `.next/dev/trace` `EBUSY` file-lock errors.

### Current local dev notes
- `npm run dev` was restarted during this session.
- Local app URL:
  - `http://localhost:3000`
- Current local `.env.local` intent:
  - `NEXT_PUBLIC_SUPABASE_URL=https://ravenskys.tail490ef5.ts.net`
- This is correct for parity with Vercel, but only works if the public Funnel/public path is actually reachable.

### Open follow-up
- On the server, verify the self-hosted public path:
  - `tailscale status`
  - `tailscale funnel status`
  - `tailscale serve status`
  - `curl -I http://127.0.0.1:8088/auth/v1/health`
  - `curl -I http://192.168.1.242:8000/auth/v1/health`
  - `curl -I http://100.76.54.98:8000/auth/v1/health`
- Finish the customer quote review/e-sign flow:
  - add customer-facing portal UI
  - finish and validate the new customer estimate API route
  - apply the quote-signature migration to the database
- Decide when to fully remove the old `TechnicianWorkspacePage` code from `src/app/tech/page.tsx`
- If committing next, do not include:
  - `.codex/`
  - `.codex-dev.log`

## 2026-05-03

### Summary
- Self-hosted Supabase is the active backend for the app.
- Public HTTPS access is working through Tailscale Funnel at `https://ravenskys.tail490ef5.ts.net`.
- Employee account management and admin-only audit tracking were added.
- Portal mobile navigation was moved into a hamburger menu for smaller screens.

### Completed
- Added customer password change flow in `src/app/customer/account/page.tsx`.
- Added employee account update routes:
  - `src/app/api/internal/employees/route.ts`
  - `src/app/api/internal/employees/[userId]/route.ts`
  - `src/app/api/internal/employees/audit/route.ts`
- Added manager/admin employee management UI:
  - `src/app/manager/employees/page.tsx`
- Added schema migration:
  - `supabase/migrations/20260503143000_add_employee_account_audit_and_status.sql`
- Applied that migration to the self-hosted Supabase database.
- Added mobile portal navigation behavior in `src/components/portal/PortalTopNav.tsx`.
- Tightened manager/portal mobile layout styles in `src/app/globals.css`.
- Refreshed `SESSION_HANDOFF.md`.

### Verified
- `npm run typecheck`
- `npm run lint` with only pre-existing warnings
- Public Supabase health endpoint:
  - `https://ravenskys.tail490ef5.ts.net/auth/v1/health`
- GitHub pushes completed through:
  - `81fc169` `Add employee account management and audit trail`
  - `e82f4b0` `Refresh session handoff for self-hosted Supabase`
  - `b033626` `Improve portal mobile navigation`

### Current deployment notes
- Vercel should use:
  - `NEXT_PUBLIC_SUPABASE_URL=https://ravenskys.tail490ef5.ts.net`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<self-hosted anon key>`
  - `SUPABASE_SERVICE_ROLE_KEY=<self-hosted service role key>`
- Local `.env.local` still uses the LAN URL for `NEXT_PUBLIC_SUPABASE_URL` and may be worth aligning later.

### Open follow-up
- Confirm Vercel has all three Supabase environment variables for `Production` and `Preview`.
- If `/manager/employees` still returns `Unauthorized`, test again after a full sign-out/sign-in because the Supabase base URL changed.
- If mobile usability still has rough edges, inspect individual manager pages after the shared nav change.
