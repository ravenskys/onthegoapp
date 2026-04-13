# On The Go Maintenance Implementation Handoff

## Purpose
This document double-checks the current repo against the proposed platform structure and turns the handoff into an implementation-ready reference for:

1. permissions matrix
2. route protection plan
3. role-based navigation
4. database and RLS mapping

It is written against the current codebase state in `src/app`, `src/lib`, and `supabase/migrations`.

## Current Repo Reality Check

### Already present
- Public pages:
  - `/`
  - `/about`
  - `/services`
  - `/contact`
  - `/fleet-services`
- Portal router:
  - `/portal`
- Customer pages:
  - `/customer/login`
  - `/customer/signup`
  - `/customer/reset-password`
  - `/customer/link`
  - `/customer/dashboard`
  - `/customer/account`
  - `/customer/book`
  - `/customer/schedule`
  - `/customer/progress`
  - `/customer/reports`
- Technician pages:
  - `/tech`
  - `/tech/jobs`
- Manager pages:
  - `/manager`
  - `/manager/jobs` (hub)
  - `/manager/jobs/list`
  - `/manager/jobs/new`
  - `/manager/jobs/[jobId]`
  - `/manager/customers`
  - `/manager/customers/[customerId]`
  - `/manager/schedule`
  - `/manager/availability`
  - `/manager/employees`
- Admin pages:
  - `/admin`
  - `/admin/settings`
- Role helper:
  - `src/lib/portal-auth.ts`
- Shared portal navigation:
  - `src/components/portal/PortalTopNav.tsx`
  - `src/lib/portal-nav-config.ts` (single source of truth for top-nav items per role)
- RLS foundation exists for many business objects in `supabase/migrations`

### Gaps or mismatches from the proposed handoff
- Public route naming differs:
  - proposed `/fleet`, current `/fleet-services`
  - proposed `/request-service`, current primary guided entry is `/customer/book` (wizard) and advanced form is `/customer/schedule`
- Auth route naming differs:
  - proposed `/login` and `/signup`
  - current `/customer/login` and `/customer/signup`
- Customer area naming differs:
  - proposed `/customer/vehicles`, `/appointments`, `/estimates`, `/invoices`, `/history`, `/inspections`, `/profile`
  - current `dashboard`, `account`, `schedule`, `progress`, `reports`
- Manager area naming differs:
  - proposed wider operational suite
  - current implementation centers on jobs, customers, schedule, availability
- Admin area naming differs:
  - proposed multiple admin modules
  - current implementation is `home` and `settings`
- Route protection: segment layouts now wrap `PortalRouteGuard` for `customer`, `tech`, `manager`, and `admin` (`src/components/portal/PortalRouteGuard.tsx`). Many pages still perform their own redirects; middleware/SSR guards remain a future upgrade.

## Recommended Route Canon

Use the current route structure as the immediate source of truth, then expand toward the target map without breaking existing links.

### Public
- `/`
- `/about`
- `/services`
- `/fleet-services`
- `/contact`
- future: `/faq`
- future: `/request-service`

### Auth and portal entry
- keep current:
  - `/customer/login`
  - `/customer/signup`
  - `/portal`
- optional later aliases:
  - `/login` -> redirect to `/customer/login`
  - `/signup` -> redirect to `/customer/signup`

### Customer
- current:
  - `/customer/dashboard`
  - `/customer/account`
  - `/customer/book`
  - `/customer/schedule`
  - `/customer/progress`
  - `/customer/reports`
- recommended future expansion:
  - `/customer/vehicles`
  - `/customer/appointments`
  - `/customer/estimates`
  - `/customer/invoices`
  - `/customer/history`
  - `/customer/inspections`
  - `/customer/profile`

### Technician
- current:
  - `/tech`
  - `/tech/jobs`
- recommended next:
  - `/tech/jobs/[jobId]`
  - `/tech/schedule`
  - `/tech/time`
  - `/tech/profile`

### Manager
- current:
  - `/manager`
  - `/manager/jobs` (hub)
  - `/manager/jobs/list`
  - `/manager/jobs/new`
  - `/manager/jobs/[jobId]`
  - `/manager/customers`
  - `/manager/customers/[customerId]`
  - `/manager/schedule`
  - `/manager/availability`
- recommended next:
  - `/manager/vehicles`
  - `/manager/appointments`
  - `/manager/estimates`
  - `/manager/invoices`
  - `/manager/reports`
  - `/manager/service-catalog`

### Admin
- current:
  - `/admin`
  - `/admin/settings`
- recommended next:
  - `/admin/users`
  - `/admin/roles`
  - `/admin/business-settings`
  - `/admin/tax-settings`
  - `/admin/templates`
  - `/admin/logs`
  - `/admin/reports`

## Permissions Matrix

Legend:
- `R` read
- `C` create
- `E` edit
- `D` delete
- `A` approve
- `S` assign
- `X` administer

| Feature / Object | Customer | Technician | Manager | Admin |
|---|---|---|---|---|
| Own profile | R,E | R,E | R,E | R,E |
| User roles | - | - | - | R,C,E,D,X |
| Customers | R own,E own | R assigned context | R,C,E | R,C,E,D,X |
| Customer addresses | R own,C,E own | R assigned context | R,C,E | R,C,E,D,X |
| Vehicles | R own,C,E own | R assigned context,C,E assigned context | R,C,E | R,C,E,D,X |
| Service requests | R own,C | R assigned context | R,C,E | R,C,E,D,X |
| Jobs | R own limited | R assigned,C/E limited | R,C,E,D,S,A | R,C,E,D,S,A,X |
| Job assignments | - | R own,E own acknowledgement/status only | R,C,E,D,S | R,C,E,D,S,X |
| Job status history | R own limited | R assigned | R | R,X |
| Job notes - customer visible | R own | R assigned,C,E own | R,C,E | R,C,E,D,X |
| Job notes - internal | - | R assigned,C,E own | R,C,E | R,C,E,D,X |
| Job services | R own | R assigned,C,E limited | R,C,E,D | R,C,E,D,X |
| Job parts | R own customer-safe | R assigned,C,E limited | R,C,E,D | R,C,E,D,X |
| Job checklists / inspections | R own customer-safe | R assigned,C,E | R,C,E | R,C,E,D,X |
| Inspection reports | R own | R assigned,C,E | R,C,E | R,C,E,D,X |
| Inspection photos | R own | R assigned,C,E | R,C,E | R,C,E,D,X |
| Time entries | - | R own,C,E own | R,C,E | R,C,E,D,X |
| Appointments | R own | R assigned | R,C,E,D,S | R,C,E,D,S,X |
| Estimates | R own,A | R job-related read only | R,C,E,D,A | R,C,E,D,A,X |
| Estimate line items | R own | R job-related read only | R,C,E,D | R,C,E,D,X |
| Invoices | R own | R job-related read only | R,C,E,D | R,C,E,D,X |
| Invoice line items | R own | R job-related read only | R,C,E,D | R,C,E,D,X |
| Payments | R own | - | R,C,E | R,C,E,D,X |
| Inventory items | - | R active only | R,C,E,D | R,C,E,D,X |
| Inventory transactions | - | - | R,C,E | R,C,E,D,X |
| Technician schedule blocks | - | R own,C,E own | R,C,E,D,S | R,C,E,D,S,X |
| Service catalog | R active/bookable only | R active | R,C,E,D | R,C,E,D,X |
| Business settings | - | - | R limited if allowed | R,E,X |
| Tax settings | - | - | R limited if allowed | R,E,X |
| Templates | - | - | R limited if allowed | R,C,E,D,X |
| Audit logs | - | - | R | R,C,E,D,X |

## Route Protection Plan

### Protection goals
- Keep page access consistent with Supabase RLS.
- Centralize role checks instead of repeating page-level redirect logic everywhere.
- Preserve multi-role portal selection with `/portal`.

### Recommended access rules
- Public:
  - `/`, `/about`, `/services`, `/fleet-services`, `/contact`
- Auth-only:
  - `/portal`
- Customer role:
  - `/customer/**`
- Technician role or higher:
  - `/tech/**`
- Manager role or higher:
  - `/manager/**`
- Admin only:
  - `/admin/**`

### Role inheritance
- Customer: customer only
- Technician portal: technician, manager, admin
- Manager portal: manager, admin
- Admin portal: admin only

This already matches `portalAccessMap` in `src/lib/portal-auth.ts`.

### Recommended implementation order
1. Add shared role-guard helpers that return `user`, `roles`, and redirect target. (Partially addressed: `PortalRouteGuard` centralizes the redirect pattern.)
2. Move protection into route-group layouts where possible:
   - `src/app/customer/layout.tsx`
   - `src/app/tech/layout.tsx`
   - `src/app/manager/layout.tsx`
   - `src/app/admin/layout.tsx`  
   (Done: each uses `PortalRouteGuard`; customer auth pages skip the guard.)
3. Keep page-level checks temporarily for high-risk pages until layouts are verified.
4. Add server-aware protection later using middleware or server components if auth model is upgraded for SSR.

### Immediate layout expectations
- Customer layout:
  - signed-in user required
  - must have `customer` access
- Tech layout:
  - signed-in user required
  - must have `tech` access
- Manager layout:
  - signed-in user required
  - must have `manager` access
- Admin layout:
  - signed-in user required
  - must have `admin` access

### Redirect behavior
- not signed in -> `/customer/login`
- signed in but wrong role -> `getPostLoginRoute(roles)`
- multi-role users -> `/portal` after login

## Sidebar / Navigation Structure

These are the recommended role-specific nav groups. The current implementation uses `PortalTopNav`; this structure can feed either a top nav or future sidebars.

### Customer
- Dashboard
- Get Service (guided wizard → scheduler)
- Service Progress
- Reports
- Account
- future:
  - Vehicles
  - Appointments
  - Estimates
  - Invoices
  - History
  - Inspections
  - Profile

### Technician
- Inspection Home
- My Jobs
- My Schedule
- Time Tracking
- Profile

### Manager
- Dashboard
- Jobs (hub + list + create flows; no separate “New Job” tab)
- Schedule
- Availability
- Employees (when enabled)
- Customers
- Vehicles
- Appointments
- Estimates
- Invoices
- Reports
- Service Catalog

### Admin
- Admin Home
- Users
- Roles
- Settings
- Business Settings
- Tax Settings
- Templates
- Logs
- Reports

## Database and RLS Mapping

This section maps the intended role model to the current RLS direction in Supabase.

### Strongly aligned already
- `user_roles`
  - self-read policy exists
  - internal role read policy exists
- `customers`
  - customers can read and update their own or claimable records
  - internal roles can read/insert/update
- `vehicles`
  - customers can read own
  - customer write policy added
  - internal roles can read/insert/update
- `jobs`
  - customers can read own
  - technicians can read assigned
  - managers and admins can read/insert/update
  - delete policy exists for managers/admins in later audit migration
- `appointments`
  - customers own
  - technicians assigned
  - managers/admins full operational access
- `time_entries`
  - technicians own
  - managers/admins all
- `estimates`, `estimate_line_items`
  - customers own read
  - technicians job-related read
  - managers/admins operational access
- `invoices`, `invoice_line_items`
  - customers own read
  - technicians job-related read
  - managers/admins operational access
- `job_notes`
  - customer-visible split already exists conceptually in policy design
- `job_parts`, `job_services`, `job_checklists`
  - customer own read
  - technician job-related limited write
  - manager/admin broader access
- `inspection_reports`, `inspection_photos`
  - customer own read
  - internal roles broader access
- `customer_addresses`
  - customer own
  - manager/admin broader access
- `service_catalog`
  - authenticated users can read active catalog
  - managers/admins full editing
- `service_catalog_parts`
  - managers/admins full editing
- `technician_schedule_blocks`
  - technicians own
  - managers/admins broader access
  - customer-safe read policy exists for available blocks
- `business_settings`
  - internal-only read/update direction already exists

### Objects in handoff that need explicit verification or additional schema/policies
- `profiles`
  - basic self/internal read exists, but role-based edit boundaries should be reviewed
- `job_status_history`
  - route/UI intent is clear, but policy coverage should be verified before exposing widely
- `notifications`
  - listed in handoff, not yet clearly represented in current repo
- `payments` vs `job_payments`
  - current repo references `job_payments`; payment strategy should be normalized
- `inventory_items` and `inventory_transactions`
  - RLS exists, but UI modules are still pending
- `templates`
  - likely admin-managed, but schema/UI still pending
- `tax settings`
  - likely part of `business_settings` or future dedicated table, should be normalized before admin buildout
- `logs`
  - deleted job audit exists; broader audit log model is still partial

## Feature-to-RLS Rules To Preserve

### Customer
- never expose internal notes
- never expose other customers
- never expose role/user administration
- never expose cost or margin data

### Technician
- read only assigned operational records
- write only field-execution records tied to assigned jobs
- no access to business settings, roles, tax settings, or global reporting

### Manager
- full operational visibility
- no platform security or role administration unless explicitly delegated
- read audit logs, but do not allow deletion

### Admin
- full access
- retains configuration, role, and audit authority

## Recommended Next Build Order

1. Formalize nav config into one source of truth by role. (Done: `src/lib/portal-nav-config.ts` feeds `PortalTopNav`.)
2. Implement protected layouts for `customer`, `tech`, `manager`, and `admin`. (Done: `PortalRouteGuard` in each segment layout.)
3. Add missing routes as lightweight placeholders in the proposed map.
4. Normalize naming decisions:
   - decide whether to keep `/customer/login` or alias `/login`
   - decide whether `/fleet-services` becomes `/fleet`
   - decide whether `/customer/schedule` is the same concept as `/request-service`
5. Audit remaining schema objects against the permissions matrix before building more UI.
6. **Vehicle catalog data**: grow the in-repo library in `src/lib/vehicleCatalog.ts` (used by `VehicleCatalogFields`) so shop and customer vehicle pickers stay accurate.
7. **Manager home UI**: refine `src/app/manager/page.tsx` layout (card grid, header, shell alignment) after functional routes are stable.

## Build Guidance For Next Chat

Use this document plus `SESSION_HANDOFF.md` as the build structure.

If the next task is implementation, the highest-value starting point is:
- **Vehicle library** and **manager dashboard layout** (see `SESSION_HANDOFF.md` “Next session — start here”), then continue with scheduler verification and service-catalog live checks.
