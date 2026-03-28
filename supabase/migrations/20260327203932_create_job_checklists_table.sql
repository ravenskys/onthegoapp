create table if not exists public.job_checklists (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_service_id uuid references public.job_services(id) on delete set null,

  step_name text not null,
  step_description text,

  step_status text not null default 'pending',
  sort_order integer not null default 0,

  completed_by_user_id uuid references auth.users(id) on delete set null,
  completed_at timestamptz,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);