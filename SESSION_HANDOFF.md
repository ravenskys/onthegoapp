# Session Handoff

## Snapshot
- Repo: `Tech app/tech-app`
- Branch: `main`
- Remote: `origin` -> `https://github.com/ravenskys/onthegoapp.git`
- Latest app commit at handoff: `81fc169` (`Add employee account management and audit trail`)

## Current Supabase setup
- Hosted Supabase is no longer the active app backend.
- The app is pointed at a self-hosted Supabase stack running on the Ubuntu/CasaOS server.
- Public browser-safe API URL now works through Tailscale Funnel:
  - `https://ravenskys.tail490ef5.ts.net`
- Local/LAN Supabase API also still exists:
  - `http://192.168.1.242:8000`
- Public health check confirmed:
  - `https://ravenskys.tail490ef5.ts.net/auth/v1/health`

## Self-hosted server summary
- Server: `192.168.1.242`
- OS: Ubuntu 24.04
- User: `ravenskys`
- Tailscale is installed and active.
- Self-hosted Supabase is running as direct Docker containers, not yet as a CasaOS-managed app.
- Working stack path on server:
  - `/DATA/AppData/supabase-selfhost/supabase/docker`
- App repo clone on server:
  - `/DATA/AppData/onthegoapp`

## Current app environment direction
- Local `.env.local` points to the self-hosted Supabase stack.
- Vercel must use:
  - `NEXT_PUBLIC_SUPABASE_URL=https://ravenskys.tail490ef5.ts.net`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<self-hosted anon key>`
- `SUPABASE_SERVICE_ROLE_KEY` remains required for admin/server routes.

## Database state
- Self-hosted schema was loaded successfully.
- One earlier seed-only migration was intentionally skipped:
  - `20260404160000_reset_and_seed_test_customers.sql`
- New migration applied in this session:
  - `supabase/migrations/20260503143000_add_employee_account_audit_and_status.sql`
- That migration adds:
  - `profiles.employment_status`
  - `employee_account_audit`
  - admin-only audit-table read policy

## Known working login
- Email: `soaringmike@pm.me`
- This user has:
  - `customer`
  - `technician`
  - `manager`
  - `admin`

## What changed in this session
- Added signed-in customer password change UI:
  - `src/app/customer/account/page.tsx`
- Added employee account management for manager/admin workflows:
  - `src/app/manager/employees/page.tsx`
- Added secure internal employee API routes:
  - `src/app/api/internal/employees/route.ts`
  - `src/app/api/internal/employees/[userId]/route.ts`
  - `src/app/api/internal/employees/audit/route.ts`
- Added tracked employee change auditing with admin-only visibility.
- Added employment status editing with statuses:
  - `active`
  - `inactive`
  - `on_leave`
  - `terminated`
- Enforced rule:
  - managers and admins can edit employee accounts
  - only admins can edit users who have `manager` or `admin` roles
- Kept technician pay management on the same employees page.

## Security and behavior notes
- Employee account edits are performed through server routes using the service role key.
- Every completed employee account change is written to `employee_account_audit`.
- Audit log is exposed only to admins.
- Raw Postgres `5432` exists but should stay private; browser/app traffic should use the HTTPS Funnel URL.
- Supabase Studio/browser access is separate from direct DB access.

## Verification completed
- `npm run typecheck` passed
- `npm run lint` passed with only pre-existing warnings elsewhere in the repo
- Self-hosted migration applied successfully to the running server
- GitHub push completed for the latest changes

## Important next steps
- If Vercel has not redeployed yet, redeploy so commit `81fc169` is live.
- Test as admin:
  - `/manager/employees`
  - edit technician account
  - confirm audit entries appear
  - confirm manager/admin targets show admin-only protection
- If desired later, convert the direct-Docker Supabase deployment into a CasaOS-managed custom app instead of treating the current stack as final.
