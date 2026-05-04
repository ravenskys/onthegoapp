# Handoff Log

This file is the running checkpoint log for the project. New entries should be added to the top with the date, what changed, what was verified, and any open follow-up items.

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
