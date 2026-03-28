create table if not exists public.job_assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  technician_user_id uuid not null references auth.users(id) on delete cascade,

  assignment_status text not null default 'assigned',
  assigned_by_user_id uuid references auth.users(id) on delete set null,

  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
