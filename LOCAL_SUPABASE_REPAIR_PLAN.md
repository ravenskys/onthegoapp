# Local Supabase Repair Plan

## What failed

`npx.cmd supabase@latest start` got far enough to create the local stack and begin running migrations, but it stopped on:

- `20260327183511_create_jobs_table.sql`

because that migration references:

- `public.customers`
- `public.vehicles`

and those tables do not exist yet in the migration history currently committed to this repo.

## Confirmed missing baseline tables from repo migrations

I checked the current `supabase/migrations` folder and there are no table-creation migrations for these core objects:

- `public.customers`
- `public.vehicles`
- `public.inspections`
- `public.inspection_photos`
- `public.inspection_reports`
- `public.profiles`
- `public.user_roles`

These tables are referenced heavily by later migrations, which means the local database cannot be rebuilt from the current repo alone.

## What this means

- Docker is working.
- Local Supabase is mostly working.
- The repo migration chain is incomplete.
- The hosted Supabase project likely contains the real baseline schema already.

## Safest recovery strategy

Do not hand-write all missing tables from memory.

Instead:

1. keep using hosted Supabase for normal app dev
2. pull or reconstruct the missing baseline schema from the hosted project
3. add that baseline to the repo
4. rerun local Supabase after the migration chain is complete

## Recommended fix order

### Option A: Find the original missing migrations

Best option if they exist anywhere else:

- another branch
- another repo
- older backup
- another machine
- a Supabase SQL export file

If found, restore them into `supabase/migrations` with their original timestamps if possible.

### Option B: Create a new baseline from the hosted project

If the original migrations are gone, rebuild the baseline from the remote project.

High-level goal:
- capture the current remote schema for the missing foundational tables
- turn that into one baseline migration that runs before `20260327183511_create_jobs_table.sql`

## Tables that should be included in the baseline

At minimum, the baseline needs correct definitions for:

- `customers`
- `vehicles`
- `profiles`
- `user_roles`
- `inspections`
- `inspection_photos`
- `inspection_reports`

It may also need any related:

- indexes
- constraints
- defaults
- grants
- enums
- triggers
- helper functions those tables depend on

## Practical command path

Run these from the repo root after setting a valid Supabase access token:

```powershell
$env:SUPABASE_ACCESS_TOKEN="your_token_here"
```

Check the linked project:

```powershell
npx.cmd supabase@latest project list
```

If needed, relink:

```powershell
npx.cmd supabase@latest link --project-ref vzshannrbrcllzzlhfju
```

Then inspect migration state:

```powershell
npx.cmd supabase@latest migration list
```

If the remote has migrations that are missing locally, recover those first.

## If remote migration history is not enough

Use the hosted project schema as the source of truth and create a baseline migration for the missing tables.

The baseline migration must come before:

- `20260327183511_create_jobs_table.sql`

Suggested timestamp prefix example:

- `20260327170000_create_core_customer_portal_tables.sql`

That migration should create the missing core tables and only the minimum dependencies needed for the later migrations to succeed.

## Important caution

Do not reorder existing later migrations unless absolutely necessary.

Prefer:

- add one earlier baseline migration

Avoid:

- renaming many later migration files
- editing live-applied migration history without a plan

## Short-term workflow until repaired

Use hosted Supabase for day-to-day development:

```powershell
npm run dev
```

Your app already reads:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

from `.env.local`, so hosted development can continue even while local Supabase is being repaired.

## Next best action

The migration history comparison has already shown that local and remote tracked migration IDs match, which means the missing foundational tables were not part of the tracked migration chain.

The next thing to do is:

1. use `MANUAL_CORE_SCHEMA_REFERENCE.md` as the recovered source of truth for the manually created baseline tables
2. use `BASELINE_MIGRATION_PLAN.md` as the implementation blueprint for the future baseline migration
3. decide whether to restore old original migrations if they exist anywhere else
4. if not, generate a new baseline migration from the recovered schema and add it carefully before `20260327183511_create_jobs_table.sql`
