# Session Handoff

## Product decisions (canonical)

- **Job source**: Customer scheduling sets `jobs.source = customer_portal`. Shop jobs from `/manager/jobs/new` use `source = manual` and `created_by_user_id` (manager). Jobs list can filter by source.
- **`appointments` vs `jobs`**: Customer scheduling writes to `public.jobs`. `public.appointments` exists for conflict checks in scheduler SQL; mirroring bookings into `appointments` is deferred.
- **Technician pay vs job/service cost**: Open — define pay rules, then wire displays (catalog labor cost stays de-emphasized).
- **Default parts model**: Support both legacy single default-part fields and `service_catalog_parts` until you intentionally migrate away from legacy.

## Repo & tooling

- **Node**: `>=20` — see [README.md](./README.md).
- **Supabase**: `npm run supabase:link`, `supabase:migration-list`, `supabase:db-push`. Scripts use **`dotenv -o`** so **`.env.local` overrides** stale Windows `SUPABASE_*` env vars. Set **`SUPABASE_DB_PASSWORD`** from Project Settings → Database. If push complains about migration order, use **`npm run supabase:db-push:all`** (`--include-all`).
- **Layouts**: `PortalRouteGuard` (`src/components/portal/PortalRouteGuard.tsx`) guards `customer`, `tech`, `manager`, `admin` segments; login/signup/reset-password skip it.
- **Portal nav**: `src/lib/portal-nav-config.ts` → `PortalTopNav`.

## Local Supabase (optional full rebuild)

Hosted Supabase is the default dev path. For a rebuildable local DB, follow in order: [LOCAL_SUPABASE_REPAIR_PLAN.md](./LOCAL_SUPABASE_REPAIR_PLAN.md), [BASELINE_MIGRATION_PLAN.md](./BASELINE_MIGRATION_PLAN.md), [MANUAL_CORE_SCHEMA_REFERENCE.md](./MANUAL_CORE_SCHEMA_REFERENCE.md).

## Git & deploy

- **Branch**: `main` → **`origin/main`** — canonical **`onthegoapp`** (Vercel deploys from GitHub).
- **`origin`**: default push/pull. **`secondary`**: backup mirror — `git push secondary main` after `origin` when you want it in sync.
- **Latest commit**: `git log -1 --oneline` on `main` (don’t rely on hashes in this file).

## Recent milestones (summary)

| When | What |
|------|------|
| **2026-04-18** | **Mobile portal nav**: Removed mobile CSS that forced portal nav `<ul>` into a single column (it broke customer horizontal tabs). Added `otg-portal-nav--customer`, `viewportFit: cover`, safe-area padding on `body`, `100dvh` where `100vh` was used for shells. Files: `PortalTopNav.tsx`, `globals.css`, `layout.tsx`. |
| **2026-04-16** | Portal validation hints, account closure flow, job customer updates / intake, tech workflow pages, related RPCs and migrations (`20260416143000_*`, `20260416150000_*`, `20260416180000_*`). |
| **2026-04-17** | Marketing + customer continuity: `PublicSiteLayout` on customer routes, `SiteHeader` / portal tabs, Contact Us / My Portal / `PortalSwitcherDropdown`, `/portal` → `getPrimaryPortalRoute`. |
| **Earlier** | Customer book/schedule/dashboard flows, manager jobs hub, scheduler + travel heuristics, service catalog + parts templates, tech abbreviated inspection mode, inspection checklist trim — details in **git history** if needed. |

**Untracked noise to ignore or delete locally:** odd duplicate migration filenames under `supabase/migrations/` (e.g. name-clash copies); use the canonical dated files only.

## Hosted Supabase — migration sanity

For **production / shared hosted DB**, migrations should be applied in order. Confirm with `npm run supabase:migration-list` (or dashboard) rather than assuming.

**Commonly referenced batches:**

- **Scheduler / customer jobs**: `20260406120000_add_customer_scheduler_functions.sql`, vehicle RLS `20260407100000_*`, unscheduled repair `20260407113000_*`, catalog parts/cost `20260407130000_*`, `20260407133000_*`, `20260407134500_*`, seed/rates/parts table/delete policy `20260408100000_*` … `20260408120000_*`.
- **Portal / tech (2026-04-16)**: `20260416143000_*`, `20260416150000_*`, `20260416180000_*`.

If a feature fails live, check **migration applied** before debugging app code. Scheduler slots: also verify `technician_schedule_blocks` has `available` blocks in range.

**Routing / travel debug:** Mapbox travel uses `/api/routing/travel-time`. If times fall back to defaults, set **`MAPBOX_ACCESS_TOKEN`** in `.env.local` and check **`DISPATCH_ORIGIN_LAT` / `DISPATCH_ORIGIN_LNG`** when relevant.

## Open priorities

1. **Confirm deploy**: Vercel shows current `main`; smoke customer portal on a **phone** (horizontal tabs, safe areas).
2. **Mapbox / travel** (if still defaulting): token + dispatch origin env vars; verify debug line on manager/customer scheduler.
3. **Manager `/manager/jobs/new`**: Optional embedded scheduler (slots + `scheduled_start` / `scheduled_end` / tech) — mirror `/customer/schedule` / manager schedule patterns; manager-safe RPCs/RLS as needed.
4. **`vehicleCatalog.ts`**: Expand/curate make/model/engine data (feeds `VehicleCatalogFields` everywhere).
5. **`/manager/page.tsx`**: Dashboard layout aligned with jobs hub / portal patterns.
6. **Technician pay**: Product rules, then wire into job/line cost UI.
7. **`appointments` rows**: Decide whether customer scheduling should also write `appointments` or stay `jobs`-only.

## Key files (resume)

**Portal / customer / manager / tech**

- `src/lib/portal-nav-config.ts`, `src/components/portal/PortalTopNav.tsx`, `PortalRouteGuard.tsx`
- `src/app/customer/layout.tsx`, `customer/book/page.tsx`, `customer/schedule/page.tsx`, `customer/dashboard/page.tsx`, `customer/account/page.tsx`
- `src/components/site/SiteHeader.tsx`, `src/lib/site-booking.ts`, `src/app/portal/page.tsx`
- `src/app/manager/page.tsx`, `manager/jobs/page.tsx`, `manager/jobs/new/page.tsx`, `manager/jobs/list/page.tsx`, `manager/jobs/[jobId]/page.tsx`, `manager/schedule/page.tsx`, `manager/availability/page.tsx`
- `src/app/tech/page.tsx`, `tech/jobs/page.tsx`, `tech/jobs/[jobId]/workflow/page.tsx`
- `src/lib/customer-portal.ts`, `job-customer-updates.ts`, `input-validation-feedback.ts`, `vehicleCatalog.ts`, `VehicleCatalogFields.tsx`
- `src/app/admin/settings/page.tsx`, `src/app/globals.css`

**Supabase** — see migration list above; scheduler entrypoint `20260406120000_add_customer_scheduler_functions.sql`.

## Hygiene & Windows

- Don’t commit: `.next-verify-accounting/`, `.next-verify-utf8/`, `supabase/.temp/`.
- Before push: `git status`, on `main`, `git remote -v` → `onthegoapp`.
- **PowerShell**: prefer `npx.cmd supabase@latest ...` if `npx.ps1` is blocked. Project ref: `vzshannrbrcllzzlhfju`.
- Full production builds on Windows/OneDrive may hit `EPERM` on `.next` — known environment issue.

## Resume prompt

`Read SESSION_HANDOFF.md and continue from there.`
