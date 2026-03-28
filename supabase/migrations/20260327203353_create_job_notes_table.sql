create table if not exists public.job_notes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,

  note_type text not null default 'internal',
  note text not null,

  is_pinned boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);