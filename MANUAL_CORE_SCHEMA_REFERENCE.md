# Manual Core Schema Reference

## Purpose

This document centralizes the manually created core Supabase schema that was not fully represented by the tracked migration chain.

It is intended to be the shared reference for:

- future baseline migration repair
- cross-computer setup
- schema verification
- local Supabase rebuild planning

## Why This Exists

Local `supabase start` currently fails because the tracked migration chain begins with later tables like `jobs`, while some foundational tables were originally created manually or outside the current committed migration history.

The missing foundational core tables were recovered from the live Supabase project.

## Recovered Core Tables

- `public.customers`
- `public.vehicles`
- `public.profiles`
- `public.user_roles`
- `public.inspections`
- `public.inspection_photos`
- `public.inspection_reports`

## Shared Function

### `public.handle_updated_at()`

```sql
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
```

## Table Definitions

### `public.customers`

```sql
create table public.customers (
  id uuid not null default gen_random_uuid(),
  phone text not null,
  email text not null,
  created_at timestamp with time zone not null default now(),
  auth_user_id uuid null,
  first_name text not null,
  last_name text not null,
  customer_number integer null,
  tax_exempt boolean not null default false,
  constraint customers_pkey primary key (id),
  constraint customers_auth_user_id_key unique (auth_user_id)
) tablespace pg_default;

create unique index if not exists customers_customer_number_key
on public.customers using btree (customer_number)
where (customer_number is not null);
```

Canonical current policies:
- `customers_select_internal_roles_v2`
- `customers_insert_internal_roles_v2`
- `customers_update_internal_roles_v2`
- `customers_select_self_or_claimable`
- `customers_insert_self`
- `customers_update_self_or_claimable`

Legacy overlap observed live:
- `users can view matching customer row`
- `users can insert own customer row`
- `users can update own customer row`
- `internal roles can view customers`
- `admin and manager can update customers`

Grants observed:
- `authenticated`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`
- `postgres`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`
- `service_role`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`

### `public.vehicles`

```sql
create table public.vehicles (
  id uuid not null default gen_random_uuid(),
  customer_id uuid null,
  year text null,
  make text null,
  model text null,
  mileage text null,
  vin text null,
  engine_size text null,
  license_plate text null,
  state text null,
  transmission text null,
  driveline text null,
  created_at timestamp with time zone not null default now(),
  vehicle_number integer null,
  constraint vehicles_pkey primary key (id),
  constraint vehicles_customer_id_fkey foreign key (customer_id) references customers (id) on delete cascade
) tablespace pg_default;

create unique index if not exists vehicles_customer_vehicle_number_key
on public.vehicles using btree (customer_id, vehicle_number)
where (vehicle_number is not null);
```

Canonical current policies:
- `vehicles_select_internal_roles_v2`
- `vehicles_insert_internal_roles_v2`
- `vehicles_update_internal_roles_v2`
- `vehicles_select_customer_own`
- `vehicles_insert_customer_own`
- `vehicles_update_customer_own`

Grants observed:
- `authenticated`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`
- `postgres`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`
- `service_role`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`

Indexes observed:
- `vehicles_pkey`
- `vehicles_customer_vehicle_number_key`

### `public.profiles`

```sql
create table public.profiles (
  id uuid not null,
  email text not null,
  role text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  first_name text null,
  last_name text null,
  constraint profiles_pkey primary key (id),
  constraint profiles_email_key unique (email),
  constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade,
  constraint profiles_role_check check (
    role = any (
      array[
        'customer'::text,
        'technician'::text,
        'manager'::text,
        'admin'::text
      ]
    )
  )
) tablespace pg_default;

create trigger set_profiles_updated_at
before update on profiles
for each row
execute function handle_updated_at();
```

Canonical current policies:
- `profiles_select_self`
- `profiles_select_internal`
- `profiles_insert_self`
- `profiles_update_self`

Legacy overlap observed live:
- `users can view own profile`
- `users can insert own profile`
- `users can update own profile`

Grants observed:
- `authenticated`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`
- `postgres`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`
- `service_role`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`

Indexes observed:
- `profiles_pkey`
- `profiles_email_key`

### `public.user_roles`

```sql
create table public.user_roles (
  id bigint generated always as identity not null,
  user_id uuid not null,
  role text not null,
  created_at timestamp with time zone not null default now(),
  constraint user_roles_pkey primary key (id),
  constraint user_roles_user_id_role_key unique (user_id, role),
  constraint user_roles_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint user_roles_role_check check (
    role = any (
      array[
        'customer'::text,
        'technician'::text,
        'manager'::text,
        'admin'::text
      ]
    )
  )
) tablespace pg_default;
```

Canonical current policies:
- `user_roles_select_self`
- `user_roles_insert_self_customer`
- `user_roles_update_self_customer`

Legacy overlap observed live:
- `users can view own roles`
- `users can insert own customer role`
- `authenticated_users_can_read_user_roles`

Grants observed:
- `authenticated`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`
- `postgres`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`
- `service_role`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`

Indexes observed:
- `user_roles_pkey`
- `user_roles_user_id_role_key`

### `public.inspections`

```sql
create table public.inspections (
  id uuid not null default gen_random_uuid(),
  customer_id uuid null,
  vehicle_id uuid null,
  tech_name text null,
  obd_code text null,
  notes text null,
  brakes jsonb not null default '{}'::jsonb,
  tire_data jsonb not null default '{}'::jsonb,
  maintenance jsonb not null default '{}'::jsonb,
  undercar jsonb not null default '{}'::jsonb,
  inspection_summary jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint inspections_pkey primary key (id),
  constraint inspections_customer_id_fkey foreign key (customer_id) references customers (id) on delete set null,
  constraint inspections_vehicle_id_fkey foreign key (vehicle_id) references vehicles (id) on delete set null
) tablespace pg_default;
```

Canonical current policies:
- `inspections_select_internal_roles_v2`
- `inspections_insert_internal_roles_v2`
- `inspections_update_internal_roles_v2`
- `inspections_select_customer_own`

Grants observed:
- `authenticated`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`
- `postgres`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`
- `service_role`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`

Indexes observed:
- `inspections_pkey`

### `public.inspection_photos`

```sql
create table public.inspection_photos (
  id uuid not null default gen_random_uuid(),
  inspection_id uuid null,
  photo_stage text not null,
  shot_label text null,
  file_name text null,
  file_url text null,
  note text null,
  created_at timestamp with time zone not null default now(),
  constraint inspection_photos_pkey primary key (id),
  constraint inspection_photos_inspection_id_fkey foreign key (inspection_id) references inspections (id) on delete cascade
) tablespace pg_default;
```

Canonical current policies:
- `inspection_photos_select_customer_own`
- `inspection_photos_select_internal`
- `inspection_photos_insert_internal`
- `inspection_photos_update_internal`

Grants observed:
- `authenticated`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`
- `postgres`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`
- `service_role`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`

Indexes observed:
- `inspection_photos_pkey`

### `public.inspection_reports`

```sql
create table public.inspection_reports (
  id uuid not null default gen_random_uuid(),
  inspection_id uuid null,
  customer_id uuid null,
  pdf_path text not null,
  created_at timestamp with time zone not null default now(),
  constraint inspection_reports_pkey primary key (id),
  constraint inspection_reports_inspection_id_key unique (inspection_id),
  constraint inspection_reports_customer_id_fkey foreign key (customer_id) references customers (id) on delete cascade,
  constraint inspection_reports_inspection_id_fkey foreign key (inspection_id) references inspections (id) on delete cascade
) tablespace pg_default;
```

Canonical current policies:
- `inspection_reports_select_customer_own`
- `inspection_reports_select_internal`
- `inspection_reports_insert_internal`
- `inspection_reports_update_internal`

Grants observed:
- `authenticated`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`
- `postgres`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`
- `service_role`: `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`

Indexes observed:
- `inspection_reports_pkey`
- `inspection_reports_inspection_id_key`

## Notes

- This file is a schema recovery reference, not yet a migration.
- Live policies include some legacy overlap on `customers`, `profiles`, and `user_roles`.
- For any clean future baseline migration, prefer the canonical policy names listed above instead of copying all historical duplicates.
- Storage bucket policies for inspection photo/report files should be documented separately if local storage parity is needed.
- RLS enable/force settings should be verified when building the eventual baseline migration.

## Recommended Next Use

Use this file as the source document when creating a baseline migration such as:

- `supabase/migrations/20260327170000_create_core_manual_tables.sql`

That migration should be introduced carefully so local rebuilds work without disturbing the already-applied remote migration history.
