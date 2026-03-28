create table if not exists public.job_services (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,

  service_code text,
  service_name text not null,
  service_description text,

  estimated_hours numeric(6,2),
  estimated_price numeric(10,2),

  sort_order integer not null default 0,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
