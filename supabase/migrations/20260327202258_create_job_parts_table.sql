create table if not exists public.job_parts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_service_id uuid references public.job_services(id) on delete set null,

  part_number text,
  part_name text not null,
  quantity numeric(10,2) not null default 1,

  unit_cost numeric(10,2),
  unit_price numeric(10,2),

  supplier text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);