create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,

  status text not null default 'new_request',
  priority text not null default 'normal',

  service_type text not null default 'general_service',
  service_description text,

  source text not null default 'manual',

  requested_date date,
  scheduled_start timestamptz,
  scheduled_end timestamptz,

  assigned_tech_user_id uuid references auth.users(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);