create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),

  estimate_id uuid references public.estimates(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,

  invoice_status text not null default 'draft',
  invoice_number text,

  subtotal numeric(10,2),
  tax_total numeric(10,2),
  total_amount numeric(10,2),
  amount_paid numeric(10,2) not null default 0,
  balance_due numeric(10,2),

  issued_at timestamptz,
  due_at timestamptz,
  paid_in_full_at timestamptz,

  notes text,

  created_by_user_id uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);