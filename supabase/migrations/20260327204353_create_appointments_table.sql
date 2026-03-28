create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),

  service_request_id uuid references public.service_requests(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,

  appointment_status text not null default 'scheduled',
  appointment_type text not null default 'service',

  scheduled_start timestamptz not null,
  scheduled_end timestamptz,

  assigned_tech_user_id uuid references auth.users(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,

  location_name text,
  address text,
  city text,
  state text,
  zip text,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);