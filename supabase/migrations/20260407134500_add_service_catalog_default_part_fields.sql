alter table public.service_catalog
  add column if not exists default_part_name text,
  add column if not exists default_part_number text,
  add column if not exists default_part_quantity numeric(10,2),
  add column if not exists default_part_supplier text;
