# Session Handoff

## Current Status
- Branch: `main`
- Latest commit on this workspace: `02f5c29 Add customer portal scheduling updates`
- Current work has been committed and pushed to the isolated `secondary` repo.
- The deployed repo remains separate as `upstream`.

## Git Remotes
- `upstream` -> `https://github.com/onthegomaint-glitch/onthegoapp.git`
- `secondary` -> `https://github.com/onthegomaint-glitch/https---github.com-onthegomaint-glitch-onthegoapp.git`
- Push current in-progress work to `secondary` so Vercel stays untouched.
- Merge back later from `secondary` into `upstream` when the feature is ready.

## Current Git Status
- Working tree was clean immediately after pushing `02f5c29`, before this handoff update.
- If `SESSION_HANDOFF.md` appears modified, that is expected from this update.
- Untracked generated build folders, do not commit:
  - `.next-verify-accounting/`
  - `.next-verify-utf8/`

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

## Verification From Latest Work
- `npx.cmd tsc --noEmit` passed.
- `npx.cmd eslint src\app\customer\schedule\page.tsx` passed.
- `npx.cmd eslint src\app\admin\settings\page.tsx` passed.
- `npx.cmd eslint src\app\customer\account\page.tsx src\app\customer\schedule\page.tsx src\lib\customer-portal.ts` passed.
- `npx.cmd eslint src\app\manager\schedule\page.tsx src\app\manager\jobs\[jobId]\page.tsx` passed.
- `npx.cmd eslint src\lib\customer-portal.ts src\app\customer\dashboard\page.tsx src\app\customer\schedule\page.tsx` passed.
- Broader targeted checks passed earlier:
  - `npx.cmd eslint src\app\customer\schedule\page.tsx src\app\customer\dashboard\page.tsx src\components\portal\PortalTopNav.tsx src\app\manager\schedule\page.tsx src\app\manager\availability\page.tsx`
- Full production builds may still hit Windows/OneDrive `EPERM` file-lock issues in `.next` output folders.

## Important Supabase Note
- The new scheduler migration must be applied to the live Supabase database before customer scheduler slots and job creation will work live.
- The new customer vehicle write-policy migration `20260407100000_add_customer_vehicle_write_rls.sql` must also be applied before customer vehicle editing will work live.
- The new unscheduled customer request function must be applied before `Repair / Other` request submission will work live:
  - `supabase/migrations/20260407113000_add_customer_unscheduled_request_function.sql`
- The new service-catalog parts/accounting fields migration must be applied before the Admin Settings service editor can persist default parts values live:
  - `supabase/migrations/20260407130000_add_service_catalog_parts_defaults.sql`
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
- Add a way to create regular jobs, separate from customer-requested scheduler jobs.
- Connect service-catalog defaults into manager job workflow:
  - use admin-edited service duration/price/cost defaults consistently
  - consider auto-adding service-level parts/accounting defaults when catalog services are added to a job
- Decide whether customer scheduling should also create `appointments` rows or continue using `jobs` only.

## Helpful Files For Resume
- `src/app/admin/settings/page.tsx`
- `src/app/customer/schedule/page.tsx`
- `src/app/customer/dashboard/page.tsx`
- `src/app/customer/account/page.tsx`
- `src/lib/customer-portal.ts`
- `supabase/migrations/20260407100000_add_customer_vehicle_write_rls.sql`
- `supabase/migrations/20260407113000_add_customer_unscheduled_request_function.sql`
- `supabase/migrations/20260407130000_add_service_catalog_parts_defaults.sql`
- `src/app/manager/schedule/page.tsx`
- `src/app/manager/availability/page.tsx`
- `src/app/manager/jobs/new/page.tsx`
- `src/app/manager/jobs/[jobId]/page.tsx`
- `src/components/portal/PortalTopNav.tsx`
- `src/app/globals.css`
- `supabase/migrations/20260406120000_add_customer_scheduler_functions.sql`
- `supabase/migrations/20260327214639_create_service_catalog_table.sql`
- `supabase/migrations/20260327213751_create_customer_addresses_table.sql`

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
