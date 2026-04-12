# Baseline Migration Plan

## Purpose

This document defines the recommended contents and order for a future baseline migration that restores the manually created core Supabase tables needed for local rebuilds.

This is a planning document, not the migration itself.

## Why This Is Needed

Local `supabase start` currently fails because the tracked migration chain begins with tables such as `jobs`, which already reference foundational tables that were created manually outside the current migration history.

Those foundational tables are documented in:

- `MANUAL_CORE_SCHEMA_REFERENCE.md`

## Goal

Add one careful baseline migration before:

- `20260327183511_create_jobs_table.sql`

so local Supabase can build the schema in the correct order.

## Proposed Baseline Migration Name

Recommended filename:

- `supabase/migrations/20260327170000_create_core_manual_tables.sql`

The exact timestamp can vary, but it must sort before:

- `20260327183511_create_jobs_table.sql`

## Recommended Contents

### 1. Shared helper function

Create:

- `public.handle_updated_at()`

### 2. Core tables

Create in this order:

1. `public.customers`
2. `public.vehicles`
3. `public.profiles`
4. `public.user_roles`
5. `public.inspections`
6. `public.inspection_photos`
7. `public.inspection_reports`

This order preserves foreign key dependencies.

### 3. Core indexes and unique constraints

Include:

- `customers_customer_number_key`
- `vehicles_customer_vehicle_number_key`
- `profiles_email_key`
- `user_roles_user_id_role_key`
- `inspection_reports_inspection_id_key`

Primary keys and inline unique constraints should remain in the table definitions where appropriate.

### 4. Trigger

Create:

- `set_profiles_updated_at`

using:

- `public.handle_updated_at()`

### 5. Grants

Preserve the effective grants observed on the recovered core tables:

- `authenticated`
- `postgres`
- `service_role`

### 6. RLS enablement

For the recovered core tables, the baseline migration should explicitly set:

- `enable row level security`
- `force row level security`

for:

- `customers`
- `vehicles`
- `profiles`
- `user_roles`
- `inspections`
- `inspection_photos`
- `inspection_reports`

### 7. Canonical policies only

Do not recreate every historical policy found in the live project.

Use only the canonical current policies documented in:

- `MANUAL_CORE_SCHEMA_REFERENCE.md`

#### `customers`
- `customers_select_internal_roles_v2`
- `customers_insert_internal_roles_v2`
- `customers_update_internal_roles_v2`
- `customers_select_self_or_claimable`
- `customers_insert_self`
- `customers_update_self_or_claimable`

#### `vehicles`
- `vehicles_select_internal_roles_v2`
- `vehicles_insert_internal_roles_v2`
- `vehicles_update_internal_roles_v2`
- `vehicles_select_customer_own`
- `vehicles_insert_customer_own`
- `vehicles_update_customer_own`

#### `profiles`
- `profiles_select_self`
- `profiles_select_internal`
- `profiles_insert_self`
- `profiles_update_self`

#### `user_roles`
- `user_roles_select_self`
- `user_roles_insert_self_customer`
- `user_roles_update_self_customer`

#### `inspections`
- `inspections_select_internal_roles_v2`
- `inspections_insert_internal_roles_v2`
- `inspections_update_internal_roles_v2`
- `inspections_select_customer_own`

#### `inspection_photos`
- `inspection_photos_select_customer_own`
- `inspection_photos_select_internal`
- `inspection_photos_insert_internal`
- `inspection_photos_update_internal`

#### `inspection_reports`
- `inspection_reports_select_customer_own`
- `inspection_reports_select_internal`
- `inspection_reports_insert_internal`
- `inspection_reports_update_internal`

## Things To Exclude From The Baseline

Do not include:

- legacy duplicate policies
- unrelated later tables
- scheduler RPCs
- service catalog changes
- inventory changes
- deleted job audit changes
- customer scheduler functions
- later business settings changes

Those already belong to later tracked migrations.

## Cautions

### 1. Do not rewrite remote migration history

This baseline is for making local rebuilds possible. The tracked remote migration IDs already match local tracked IDs.

### 2. Do not blindly copy live duplicate policies

Some live tables contain both legacy and newer policies. Recreating all of them would preserve clutter rather than restore a clean baseline.

### 3. Keep scope narrow

The goal is to restore the minimal foundational layer needed so the existing later migrations can execute.

## Recommended Validation After Creating The Migration

After the baseline migration is created:

1. stop the local Supabase stack
2. restart with a fresh local rebuild
3. confirm `supabase start` completes
4. confirm later migrations apply successfully
5. verify the app still runs against hosted Supabase
6. verify local Supabase schema shape against the hosted project for the recovered core tables

## Source Documents

Use these documents together when building the migration:

- `MANUAL_CORE_SCHEMA_REFERENCE.md`
- `LOCAL_SUPABASE_REPAIR_PLAN.md`
- `SESSION_HANDOFF.md`

## Recommended Next Step

Before writing the actual migration, do one review pass to confirm:

- the exact RLS `enable` and `force` statements
- whether any additional helper functions are required beyond `handle_updated_at()`
- whether storage bucket policy parity is needed immediately or can wait
