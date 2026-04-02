alter table public.customers
add column if not exists tax_exempt boolean not null default false;