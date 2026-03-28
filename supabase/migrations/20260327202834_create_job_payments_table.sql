create table if not exists public.job_payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,

  payment_method text not null,
  payment_status text not null default 'pending',

  amount numeric(10,2) not null,
  paid_at timestamptz,

  reference_number text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);