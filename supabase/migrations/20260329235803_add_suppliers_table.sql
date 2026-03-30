create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  account_number text null,
  is_active boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_suppliers_updated_at
before update on public.suppliers
for each row
execute function set_updated_at();

insert into public.suppliers (name, account_number)
values
  ('AutoZone', null),
  ('O''Reilly', null),
  ('Advance Auto', null),
  ('NAPA', null),
  ('Dealership', null),
  ('Customer', null),
  ('Other', null)
on conflict (name) do nothing;