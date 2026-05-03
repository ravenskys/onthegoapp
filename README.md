# On The Go Maintenance Tech App

Role-based mobile maintenance platform built with:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase

## Current App Areas

- Public marketing site
- Customer portal
- Technician portal
- Manager portal
- Admin portal

## Current Route Highlights

- Public:
  - `/`
  - `/about`
  - `/services`
  - `/fleet-services`
  - `/contact`
- Portal entry:
  - `/portal`
- Customer:
  - `/customer/login`
  - `/customer/signup`
  - `/customer/dashboard`
  - `/customer/account`
  - `/customer/book` (guided **Get service** → scheduler)
  - `/customer/schedule`
  - `/customer/progress`
  - `/customer/reports`
- Technician:
  - `/tech`
  - `/tech/jobs`
- Manager:
  - `/manager`
  - `/manager/jobs` (hub: new / returning / open list)
  - `/manager/jobs/list`
  - `/manager/jobs/new`
  - `/manager/jobs/[jobId]`
  - `/manager/customers`
  - `/manager/schedule`
  - `/manager/availability`
  - `/manager/employees`
- Admin:
  - `/admin`
  - `/admin/settings`

## Local Development

Use **Node.js 20.x LTS** (see `engines` in `package.json`).

On a **new machine**: clone the repo, copy [`.env.example`](./.env.example) to `.env.local`, fill in secrets from Supabase and your vault (never commit `.env.local`), then install and run. See [CENTRALIZED_DEV_SETUP.md](./CENTRALIZED_DEV_SETUP.md) and [DEV_MACHINE_REQUIREMENTS.md](./DEV_MACHINE_REQUIREMENTS.md).

If Windows shows file-lock errors on `.next` builds, clone outside OneDrive when possible.

Install dependencies:

```powershell
npm install
```

Run the app:

```powershell
npm run dev
```

The app uses `.env.local` for Supabase connection values.

Required app env vars:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Optional for Supabase CLI (migrations): in `.env.local` set **`SUPABASE_ACCESS_TOKEN`** (Supabase account token) and, for commands that connect to the hosted database, **`SUPABASE_DB_PASSWORD`** (the **Database** password for the `postgres` role—Supabase dashboard → **Project Settings** → **Database**). The `npm run supabase:*` scripts load `.env.local` via **`dotenv-cli`** with **`-o` / `--override`**, so file values **win over** any `SUPABASE_*` variables already set in Windows (otherwise a stale `SUPABASE_DB_PASSWORD` in your user environment can override `.env.local` and cause `28P01`). You do not need to export variables manually in PowerShell.

Then from this folder:

```powershell
npm run supabase:migration-list
npm run supabase:db-push
```

If `migration list` or `db push` fails with **`password authentication failed` (SQLSTATE 28P01)**, the value in `.env.local` does not match the current database password: use **Reset database password** in the same Database settings page, then paste the new password into **`SUPABASE_DB_PASSWORD`** and retry.

See [SESSION_HANDOFF.md](./SESSION_HANDOFF.md) (Windows `npx.cmd` notes and project ref `vzshannrbrcllzzlhfju`).

## Supabase Notes

Hosted Supabase development works with `.env.local`.

Local Supabase is not fully rebuildable from the current tracked migration chain yet because some foundational tables were originally created manually and are now being documented for a future baseline repair.

Relevant docs:

- [SESSION_HANDOFF.md](./SESSION_HANDOFF.md)
- [IMPLEMENTATION_HANDOFF.md](./IMPLEMENTATION_HANDOFF.md)
- [DEV_MACHINE_REQUIREMENTS.md](./DEV_MACHINE_REQUIREMENTS.md)
- [CENTRALIZED_DEV_SETUP.md](./CENTRALIZED_DEV_SETUP.md)
- [LOCAL_SUPABASE_REPAIR_PLAN.md](./LOCAL_SUPABASE_REPAIR_PLAN.md)
- [MANUAL_CORE_SCHEMA_REFERENCE.md](./MANUAL_CORE_SCHEMA_REFERENCE.md)
- [BASELINE_MIGRATION_PLAN.md](./BASELINE_MIGRATION_PLAN.md)

## Project Docs

- [Session Handoff](./SESSION_HANDOFF.md)
- [Implementation Handoff](./IMPLEMENTATION_HANDOFF.md)
- [Dev Machine Requirements](./DEV_MACHINE_REQUIREMENTS.md)
- [Centralized Dev Setup](./CENTRALIZED_DEV_SETUP.md)
- [Local Supabase Repair Plan](./LOCAL_SUPABASE_REPAIR_PLAN.md)
- [Manual Core Schema Reference](./MANUAL_CORE_SCHEMA_REFERENCE.md)
- [Baseline Migration Plan](./BASELINE_MIGRATION_PLAN.md)

## Current Direction

The recommended workflow right now is:

1. Keep active app development pointed at hosted Supabase.
2. Use the schema recovery docs to restore a clean local baseline later.
3. Centralize setup and handoff docs in this repo so the project moves cleanly between computers.

Near-term product focus (see [SESSION_HANDOFF.md](./SESSION_HANDOFF.md)):

- Expand the **vehicle library** in `src/lib/vehicleCatalog.ts` (feeds vehicle pickers app-wide).
- Improve **manager home** layout at `src/app/manager/page.tsx`.
- Add **scheduling to manager create job** (`/manager/jobs/new`) so slots can be booked with the customer on the same page.
