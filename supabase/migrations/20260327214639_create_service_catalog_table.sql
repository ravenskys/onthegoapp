create table if not exists public.service_catalog (
  id uuid primary key default gen_random_uuid(),

  service_code text,
  service_name text not null,
  service_description text,

  category text,
  default_duration_minutes integer,
  default_price numeric(10,2),
  default_cost numeric(10,2),

  is_active boolean not null default true,
  is_bookable_online boolean not null default true,

  sort_order integer not null default 0,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);