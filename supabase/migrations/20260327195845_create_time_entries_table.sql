create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  technician_user_id uuid not null references auth.users(id) on delete cascade,

  entry_type text not null default 'work',
  clock_in timestamptz not null,
  clock_out timestamptz,
  duration_minutes integer,

  hourly_cost numeric(10,2),
  hourly_rate numeric(10,2),

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);