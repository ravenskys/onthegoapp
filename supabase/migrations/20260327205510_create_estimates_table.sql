create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),

  service_request_id uuid references public.service_requests(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,

  estimate_status text not null default 'draft',
  estimate_number text,

  subtotal numeric(10,2),
  tax_total numeric(10,2),
  total_amount numeric(10,2),

  valid_until date,
  approved_at timestamptz,
  declined_at timestamptz,

  notes text,

  created_by_user_id uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);