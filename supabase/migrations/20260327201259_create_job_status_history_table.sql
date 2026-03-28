create table if not exists public.job_status_history (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,

  old_status text,
  new_status text not null,

  changed_by_user_id uuid references auth.users(id) on delete set null,
  change_note text,

  created_at timestamptz not null default now()
);