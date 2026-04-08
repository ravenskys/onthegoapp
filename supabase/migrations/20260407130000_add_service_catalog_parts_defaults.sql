alter table public.service_catalog
  add column if not exists default_parts_cost numeric(10,2),
  add column if not exists default_parts_price numeric(10,2),
  add column if not exists default_parts_notes text;
