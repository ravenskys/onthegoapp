# Session Handoff

## Recorded product decisions (consolidated roadmap)

- **Job source**: Customer scheduling RPCs set `jobs.source = customer_portal`. Shop jobs created from `/manager/jobs/new` set `source = manual` and `created_by_user_id` to the signed-in manager user. The jobs list supports filtering by source (shop vs customer portal).
- **`appointments` vs `jobs`**: Customer-facing scheduling continues to write to `public.jobs` as the system of record. `public.appointments` remains in the schema and is referenced for conflict checks in scheduler SQL; automatically mirroring customer bookings into `appointments` is deferred until a dedicated calendar/appointments product pass.
- **Technician pay vs job/service cost**: Still open—wire technician pay into job or line-item cost displays after you define the pay rules (service-catalog default labor cost stays de-emphasized).
- **Default parts model**: Continue supporting both legacy single default-part fields and `service_catalog_parts` until you intentionally migrate and remove the legacy columns/UI.

## Roadmap tooling (repo)

- **Node**: `package.json` `engines.node` is `>=20`; see [README.md](./README.md) for new-machine steps.
- **Supabase CLI**: `npm run supabase:link`, `npm run supabase:migration-list`, `npm run supabase:db-push`. Scripts use **`dotenv -o`** so values in **`.env.local` override** any `SUPABASE_*` variables already set in Windows (stale env vars were causing `28P01` even when `.env.local` was correct). Set **`SUPABASE_DB_PASSWORD`** to match **Project Settings → Database**. If `db push` says a local migration must be inserted before the last remote one, use **`npm run supabase:db-push:all`** (`--include-all`).
- **Layouts**: Role checks live in `PortalRouteGuard` (`src/components/portal/PortalRouteGuard.tsx`) for `customer`, `tech`, `manager`, and `admin` segment layouts. Customer login/signup/reset-password routes skip the guard.
- **Navigation**: Top nav items are defined in `src/lib/portal-nav-config.ts` and consumed by `PortalTopNav`.

## Local Supabase baseline (when you need rebuildable local DB)

Follow in order: [LOCAL_SUPABASE_REPAIR_PLAN.md](./LOCAL_SUPABASE_REPAIR_PLAN.md), [BASELINE_MIGRATION_PLAN.md](./BASELINE_MIGRATION_PLAN.md), [MANUAL_CORE_SCHEMA_REFERENCE.md](./MANUAL_CORE_SCHEMA_REFERENCE.md). Hosted Supabase remains the default dev path until this is done.

## Current Status
- Branch: `main` (local branch tracks **`secondary/main`** for routine pushes).
- **Next convergence**: when you are ready to ship, plan a merge or PR from this line of work (**`secondary/main`**) into **`upstream/main`** (`onthegoapp`) so the primary deployed repo stays a deliberate promotion.
- Push day-to-day work to **`secondary`**; use **`upstream`** only when intentionally updating the main app repo.
- For the exact commit hash after the latest push, run `git log -1 --oneline` on `secondary/main`.

## Session checkpoint — 2026-04-12 (evening)
- **Customer portal UX**
  - `/customer/book` — step-by-step **Get service** wizard (book vs request-first, vehicle, then continue to scheduler with query params).
  - `/customer/schedule` — reads `?vehicle=&flow=book|request&guided=1` to prefill and show a guided banner; wrapped in `Suspense` for `useSearchParams`.
  - `/customer/dashboard` — overview hub tiles; combined **Service center** card (visit + recommendations); reduced duplicate service-progress content on the home page.
  - Customer top nav: **Get Service** → `/customer/book` (replaces a duplicate “Schedule only” entry); full scheduler still at `/customer/schedule`.
- **Manager portal UX**
  - `/manager/jobs` — **Jobs hub**: New customer → `/manager/jobs/new?flow=new`, Returning → `?flow=returning`, View all → `/manager/jobs/list`.
  - `/manager/jobs/list` — previous all-jobs list UI (filters, cards, delete).
  - `/manager/jobs/new` — optional **Add customer** block for `flow=new`; customer combobox auto-opens for `flow=returning`; `Suspense` wrapper for search params.
  - Manager nav: single **Jobs** item (removed separate **New Job**). Job detail “back to list” targets `/manager/jobs/list`.
  - Manager home: one **Jobs** tile (removed duplicate **New Job** tile); Customers header button goes to Jobs hub; schedule shortcut goes to hub.
- **Shared / infra touched in this stretch** (see git history for full set): `src/lib/portal-nav-config.ts`, `PortalRouteGuard`, layouts, `service-other`, `technician-pay` + migration, manager employees, job source helpers, etc.

## Git Remotes
- `upstream` -> `https://github.com/onthegomaint-glitch/onthegoapp.git`
- `secondary` -> `https://github.com/onthegomaint-glitch/https---github.com-onthegomaint-glitch-onthegoapp.git`
- Push current in-progress work to `secondary` so Vercel stays untouched.
- Merge back later from `secondary` into `upstream` when the feature is ready.

## Current Git Status
- After this handoff update, run `git status` to confirm a clean tree post-commit.
- If `SESSION_HANDOFF.md` appears modified, that is expected from this update.
- Untracked generated build folders, do not commit:
  - `.next-verify-accounting/`
  - `.next-verify-utf8/`
- Supabase local CLI temp state is machine-local and should not be committed:
  - `supabase/.temp/`

## Recently Finished
- Created manager scheduling calendar at `/manager/schedule`.
- Created dedicated employee availability page at `/manager/availability`.
- Removed the bulky `Build Employee Availability` editor from the manager calendar page.
- Added customer scheduling page at `/customer/schedule`.
- Added customer nav item and home-page CTA for `Schedule Service`.
- Added global dark-mode contrast fixes in `src/app/globals.css`.
- Changed customer scheduler service selection from freeform text to a service dropdown backed by `service_catalog.default_duration_minutes`.
- Added service address fields to the customer scheduler form.
- Added scheduler migration `20260406120000_add_customer_scheduler_functions.sql` with:
  - job columns for service duration, travel time, and service address details
  - `get_customer_available_schedule_slots(...)`
  - `create_customer_scheduled_job(...)`
  - customer-safe select policy for active `available` technician schedule blocks
- Updated scheduler travel buffer so it is estimated automatically from the technician's previous job location to the new service address:
  - same ZIP: `15` min
  - same city/state: `25` min
  - same state: `45` min
  - otherwise: `60` min
  - no previous/address data: `30` min
- Scheduler slot cards now show the estimated travel buffer, and booked jobs save that estimate.
- Customers can now update vehicles from `/customer/account`.
- Customers can now add and edit saved service addresses from `/customer/account`.
- `fetchCustomerPortalData(...)` now includes saved customer addresses so account and scheduling pages share the same customer portal data source.
- Customer scheduler address selection now uses the addresses already loaded from portal data instead of issuing a second address query.
- Added customer vehicle write policy migration `20260407100000_add_customer_vehicle_write_rls.sql` so customers can insert/update only their own vehicles.
- Manager schedule day cards now show customer-scheduled job metadata more clearly, including service address and service/travel time.
- Manager job detail now has a dedicated `Scheduled Visit Details` card for source, scheduled window, service address, and time breakdown.
- Cleaned the current manager job detail lint warnings that came from stale imports/state and the fetch effect pattern.
- Customer account vehicles now use saved-card styling with edit/delete actions, clearer identifiers, duplicate warnings, and visible saved mileage.
- Customer account service addresses now use saved-card styling with edit/delete actions and a location-type dropdown (`House`, `Condo`, `Apartment`, `Office Building`, `Other`).
- Customer account mileage display now accepts stored mileage values even when they come back in a string-like shape from Supabase.
- Customer portal vehicle ordering is now deterministic so similar vehicles do not jump around between refreshes.
- Customer dashboard and scheduler vehicle labels now show consistent plate/VIN detail text.
- Customer scheduler saved-address labels now mirror the new location-type wording from the account page.
- Customer portal nav now shows direct top tabs for customer pages instead of a single `Customer` dropdown, with a mobile-friendly horizontal-scroll tab row.
- Customer account vehicle edit/delete actions were adjusted for mobile touch targets.
- Customer scheduler service choices are now fixed customer-facing options:
  - `Oil Change` (`30` min)
  - `Inspection` (`45` min)
  - `Both` (`90` min)
  - `Repair / Other` (no slot booking; sends a follow-up request)
- Customer scheduler location type now matches account-page behavior:
  - dropdown for `House`, `Condo`, `Apartment`, `Office Building`, `Other`
  - required custom description when `Other` is selected
- Customer scheduler flow is now:
  - service/vehicle/location details first
  - scheduler appears below only when the request is schedulable
  - submit button is at the bottom after the scheduler section
- Customer scheduler now auto-saves a new address to `customer_addresses` when the customer submits and the current service address is not already in saved addresses.
- For `Condo`, `Apartment`, `Office Building`, and `Other`, customer scheduler now requires a permission-confirmation checkbox before the scheduler becomes available.
- Customer scheduler validation now highlights missing required fields in red and shows inline helper text after a failed submit attempt.
- `Repair / Other` now uses a dedicated unscheduled customer request RPC instead of trying to create a booked slot:
  - `supabase/migrations/20260407113000_add_customer_unscheduled_request_function.sql`
  - this inserts into `jobs`, not `appointments`
- Confirmed current customer scheduling behavior:
  - scheduled bookings populate `public.jobs`
  - unscheduled repair requests also populate `public.jobs`
  - `public.appointments` is checked for conflicts but is not currently populated by the customer scheduler flow
- Admin Settings now includes editable `Services Offered` management from the UI:
  - service name/code/category/description
  - default duration
  - default labor price and labor cost
  - default parts price and parts cost
  - default parts notes
  - active / bookable-online flags
  - sort order / internal notes
- Added service-catalog parts/accounting defaults migration:
  - `supabase/migrations/20260407130000_add_service_catalog_parts_defaults.sql`
- Manager job workflow now uses admin-edited service catalog defaults more directly:
  - adding a catalog service to a job now copies default labor hours, labor price, and labor cost
  - estimate generation now carries service labor cost into `estimate_line_items.unit_cost`
  - manager job detail service editing now includes `Estimated Cost`
- Added job-services labor-cost migration:
  - `supabase/migrations/20260407133000_add_job_services_estimated_cost.sql`
- Service catalog defaults are now more structured for parts:
  - default part name
  - default part number
  - default part quantity
  - default part supplier
  - default parts price / cost / notes
- Manager job detail now auto-creates a linked `job_parts` row from service-catalog defaults when a catalog service includes default part/accounting values.
- Added structured default-part fields migration:
  - `supabase/migrations/20260407134500_add_service_catalog_default_part_fields.sql`
- Added starter service-catalog seed migration with common lube/tune and maintenance services:
  - `supabase/migrations/20260408100000_seed_common_service_catalog.sql`
  - updates known service codes and inserts missing starter services
  - includes common services such as oil change, inspection, tire rotation, brake service, coolant flush, transmission fluid service, tune up, belts, battery, filters, and A/C performance service
- Added labor-rate migration for active service-catalog defaults:
  - `supabase/migrations/20260408110000_update_service_catalog_labor_rates.sql`
  - default labor price now calculates from `default_duration_minutes` at `$120/hour`
  - default labor cost now calculates from `default_duration_minutes` at `$30/hour`
- Added reusable default-parts template table for services:
  - `supabase/migrations/20260408113000_add_service_catalog_parts_table.sql`
  - introduces `public.service_catalog_parts`
  - seeds common generic parts per service, such as oil/filter/gasket, brake pads/rotors/hardware, coolant, transmission fluid/filter, spark plugs, battery, and wiper blades
- Admin Settings service editor now supports a full `Default Parts List` per service in addition to the older single default-part fields.
- Manager job detail catalog-service add flow now prefers the new `service_catalog_parts` templates:
  - adding a catalog service creates editable `job_parts` placeholder rows from the generic parts list
  - managers/techs can then fill in exact part numbers, suppliers, unit cost, and unit price case by case
  - legacy single default-part fields still work as a backward-compatible fallback
- Admin Settings now supports deleting services from the service catalog UI.
- Service-sheet labor cost is no longer being treated as an admin-managed default on the service catalog page:
  - the admin service form now auto-calculates only default labor price from duration
  - manager job add-from-catalog no longer preloads `estimated_cost` from `service_catalog.default_cost`
  - this leaves labor cost to be sourced from the technician pay / actual-cost workflow instead of a catalog default
- Added service-catalog delete-policy migration:
  - `supabase/migrations/20260408120000_add_service_catalog_delete_policy.sql`
- Admin Settings `Services Offered` now has a more compact browsing experience:
  - searchable service list
  - compact saved-service cards
  - full card acts as the details toggle
  - only one service card expands at a time
- Technician page now supports an abbreviated inspection mode for non-inspection jobs:
  - full inspection remains for `Inspection` and `Oil Change + Inspection`
  - abbreviated inspection is used for service jobs like oil changes, tune-ups, and repair work
  - abbreviated jobs hide the separate tire and brake tabs and use a lighter maintenance/undercar workflow
  - active job card now shows the current inspection mode
- Standard inspection checklist was trimmed to better match a real mobile/no-lift workflow:
  - removed `Timing Belt`
  - removed `Spark Plugs`
  - removed `Link Pins`, `Center Link`, `Control Arms`, `Hub / Bearings`, `Bushings`, `Ball Joints`, and `Intermediate Pipe`

## Verification From Latest Work
- `npx.cmd tsc --noEmit` passed (including after abbreviated inspection / checklist work).
- Targeted `npx.cmd eslint` passed on customer schedule/account/portal, manager schedule/jobs, admin settings (service catalog, delete flow, default parts), and `src\app\tech\page.tsx` (image warnings only there).
- Full production builds may still hit Windows/OneDrive `EPERM` file-lock issues in `.next` output folders.

## Important Supabase Note
- The new scheduler migration must be applied to the live Supabase database before customer scheduler slots and job creation will work live.
- The new customer vehicle write-policy migration `20260407100000_add_customer_vehicle_write_rls.sql` must also be applied before customer vehicle editing will work live.
- The new unscheduled customer request function must be applied before `Repair / Other` request submission will work live:
  - `supabase/migrations/20260407113000_add_customer_unscheduled_request_function.sql`
- The new service-catalog parts/accounting fields migration must be applied before the Admin Settings service editor can persist default parts values live:
  - `supabase/migrations/20260407130000_add_service_catalog_parts_defaults.sql`
- The new job-services labor-cost migration must be applied before manager job services can persist `estimated_cost` live:
  - `supabase/migrations/20260407133000_add_job_services_estimated_cost.sql`
- The new structured default-part fields migration must be applied before Admin Settings can persist default part name/number/qty/supplier live:
  - `supabase/migrations/20260407134500_add_service_catalog_default_part_fields.sql`
- The following service-catalog migrations were created and pushed live during this session:
  - `supabase/migrations/20260408100000_seed_common_service_catalog.sql`
  - `supabase/migrations/20260408110000_update_service_catalog_labor_rates.sql`
  - `supabase/migrations/20260408113000_add_service_catalog_parts_table.sql`
- If `/customer/schedule` shows no slots after applying code, check:
  - migration applied
  - employees have active `available` blocks in `technician_schedule_blocks`
  - blocks are inside the next 21 days
  - selected service duration plus estimated travel fits inside an availability block
- If `Repair / Other` shows `Failed to schedule customer service: {}` in a stale dev bundle, restart the dev server and hard refresh; the current source now logs/reads the real Supabase error via `getErrorMessage(...)`.

## Next Priority List
- Finish the scheduler:
  - review live behavior after all recent Supabase migrations are applied
  - verify customer account editing live after both recent vehicle/address migrations are applied
  - verify scheduled bookings and unscheduled repair requests both create the expected `jobs` rows live
  - verify `Repair / Other` live after applying the new unscheduled-request RPC migration
  - verify saved addresses from `/customer/account` appear immediately in `/customer/schedule`
  - verify required-field red states/inline helper text are visible in the live theme and not being overridden
  - verify permission-confirmation gating for condo/apartment/office/other locations
  - consider replacing ZIP/city heuristic with a maps API later if real drive times are needed
- Shop-created “regular” jobs (separate from customer portal bookings): start from **`/manager/jobs`** (hub) → **New customer** or **Returning customer** → **`/manager/jobs/new`** with optional `?flow=` (`jobs.source = manual`); full list and filters at **`/manager/jobs/list`**.
- Connect service-catalog defaults into manager job workflow:
  - verify new default labor price / default part integration live after the new migrations are applied
  - verify the new `service_catalog_parts` templates create the expected editable `job_parts` rows when a catalog service is added to a job
  - verify service deletion works live in Admin Settings (delete-policy migration is on hosted DB)
  - decide whether to keep the older single default-part fields long term or eventually migrate fully to the new parts-list model
  - decide how technician pay should flow into job/service cost calculations, since service-catalog labor cost has been de-emphasized
- Verify the new abbreviated inspection mode live on `/tech`:
  - confirm oil-change / tune-up / repair jobs load the shorter tab set
  - confirm full inspection jobs still load the complete tire/brake workflow
- Decide whether customer scheduling should also create `appointments` rows or continue using `jobs` only.

## Helpful Files For Resume
- `src/lib/portal-nav-config.ts`
- `src/app/customer/book/page.tsx`
- `src/app/customer/schedule/page.tsx`
- `src/app/customer/dashboard/page.tsx`
- `src/app/customer/layout.tsx`
- `src/components/portal/PortalRouteGuard.tsx`
- `src/app/manager/jobs/page.tsx` (hub)
- `src/app/manager/jobs/list/page.tsx`
- `src/app/manager/jobs/new/page.tsx`
- `src/app/admin/settings/page.tsx`
- `src/app/customer/account/page.tsx`
- `src/lib/customer-portal.ts`
- `supabase/migrations/20260407100000_add_customer_vehicle_write_rls.sql`
- `supabase/migrations/20260407113000_add_customer_unscheduled_request_function.sql`
- `supabase/migrations/20260407130000_add_service_catalog_parts_defaults.sql`
- `supabase/migrations/20260407133000_add_job_services_estimated_cost.sql`
- `supabase/migrations/20260407134500_add_service_catalog_default_part_fields.sql`
- `supabase/migrations/20260408100000_seed_common_service_catalog.sql`
- `supabase/migrations/20260408110000_update_service_catalog_labor_rates.sql`
- `supabase/migrations/20260408113000_add_service_catalog_parts_table.sql`
- `supabase/migrations/20260408120000_add_service_catalog_delete_policy.sql`
- `src/app/manager/schedule/page.tsx`
- `src/app/manager/availability/page.tsx`
- `src/app/manager/jobs/[jobId]/page.tsx`
- `src/app/tech/page.tsx`
- `src/lib/inspection-workflow.ts`
- `src/lib/service-other.ts`
- `src/lib/job-source.ts`
- `src/components/portal/PortalTopNav.tsx`
- `src/app/globals.css`
- `supabase/migrations/20260406120000_add_customer_scheduler_functions.sql`
- `supabase/migrations/20260327214639_create_service_catalog_table.sql`
- `supabase/migrations/20260327213751_create_customer_addresses_table.sql`
- `supabase/migrations/20260415120000_create_technician_pay_rates.sql` (if present in tree; technician pay wiring)
- `src/lib/technician-pay.ts`

## Good Resume Prompt
Use this when resuming:

`Read SESSION_HANDOFF.md and continue from there.`

## If Something Looks Broken Again
- Check `git status --short` first.
- Do not commit `.next-verify-accounting/` or `.next-verify-utf8/`.
- Confirm the target remote before pushing:
  - use `secondary` for isolated feature work
  - use `upstream` only when intentionally updating the deployed repo
- Confirm latest pushed commit before pushing.
- If scheduling fails live, check Supabase migration state before debugging React code.

## Supabase CLI Windows Notes
- This repo is linked to Supabase project ref `vzshannrbrcllzzlhfju`.
- On Windows PowerShell, use `npx.cmd supabase@latest ...` instead of `npx supabase@latest ...` because PowerShell may block `npx.ps1` with execution-policy errors.
- Use a local environment variable for the Supabase personal access token:
  - current shell only:
    - `$env:SUPABASE_ACCESS_TOKEN="your_new_token_here"`
  - persist for the current Windows user:
    - `[System.Environment]::SetEnvironmentVariable("SUPABASE_ACCESS_TOKEN","your_new_token_here","User")`
- Verify auth in the same PowerShell window with:
  - `echo $env:SUPABASE_ACCESS_TOKEN`
  - `npx.cmd supabase@latest migration list`
- Typical commands:
  - `npx.cmd supabase@latest link --project-ref vzshannrbrcllzzlhfju`
  - `npx.cmd supabase@latest db push`
