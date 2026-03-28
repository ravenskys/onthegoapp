create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,

  address_type text not null default 'service',
  is_default boolean not null default false,

  label text,
  contact_name text,
  contact_phone text,

  address text not null,
  city text,
  state text,
  zip text,

  gate_code text,
  parking_notes text,
  service_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);