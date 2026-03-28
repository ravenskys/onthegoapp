create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,

  status text not null default 'new',
  source text not null default 'website',

  requested_service text not null,
  service_details text,

  preferred_date date,
  preferred_time_window text,

  address text,
  city text,
  state text,
  zip text,

  contact_name text,
  contact_phone text,
  contact_email text,

  converted_to_job_id uuid references public.jobs(id) on delete set null,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);