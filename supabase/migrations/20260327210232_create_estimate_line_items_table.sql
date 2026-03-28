create table if not exists public.estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,

  line_type text not null default 'service',
  description text not null,

  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2),
  unit_cost numeric(10,2),

  taxable boolean not null default true,
  sort_order integer not null default 0,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);