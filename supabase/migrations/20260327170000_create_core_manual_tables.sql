create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create table if not exists public.customers (
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
);

create unique index if not exists customers_customer_number_key
on public.customers using btree (customer_number)
where customer_number is not null;

create table if not exists public.vehicles (
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
  constraint vehicles_customer_id_fkey foreign key (customer_id) references public.customers (id) on delete cascade
);

create unique index if not exists vehicles_customer_vehicle_number_key
on public.vehicles using btree (customer_id, vehicle_number)
where vehicle_number is not null;

create table if not exists public.profiles (
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
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.handle_updated_at();

create table if not exists public.user_roles (
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
);

create table if not exists public.inspections (
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
  constraint inspections_customer_id_fkey foreign key (customer_id) references public.customers (id) on delete set null,
  constraint inspections_vehicle_id_fkey foreign key (vehicle_id) references public.vehicles (id) on delete set null
);

create table if not exists public.inspection_photos (
  id uuid not null default gen_random_uuid(),
  inspection_id uuid null,
  photo_stage text not null,
  shot_label text null,
  file_name text null,
  file_url text null,
  note text null,
  created_at timestamp with time zone not null default now(),
  constraint inspection_photos_pkey primary key (id),
  constraint inspection_photos_inspection_id_fkey foreign key (inspection_id) references public.inspections (id) on delete cascade
);

create table if not exists public.inspection_reports (
  id uuid not null default gen_random_uuid(),
  inspection_id uuid null,
  customer_id uuid null,
  pdf_path text not null,
  created_at timestamp with time zone not null default now(),
  constraint inspection_reports_pkey primary key (id),
  constraint inspection_reports_inspection_id_key unique (inspection_id),
  constraint inspection_reports_customer_id_fkey foreign key (customer_id) references public.customers (id) on delete cascade,
  constraint inspection_reports_inspection_id_fkey foreign key (inspection_id) references public.inspections (id) on delete cascade
);
