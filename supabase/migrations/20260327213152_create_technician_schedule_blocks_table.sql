create table if not exists public.technician_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  technician_user_id uuid not null references auth.users(id) on delete cascade,

  block_type text not null default 'unavailable',
  status text not null default 'active',

  starts_at timestamptz not null,
  ends_at timestamptz not null,

  title text,
  notes text,

  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);