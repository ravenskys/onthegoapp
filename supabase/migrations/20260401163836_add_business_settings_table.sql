create table if not exists public.business_settings (
  id uuid primary key default gen_random_uuid(),
  default_service_tax_rate numeric(6, 3) not null default 0,
  default_parts_tax_rate numeric(6, 3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_business_settings_updated_at on public.business_settings;

create trigger set_business_settings_updated_at
before update on public.business_settings
for each row
execute function set_updated_at();

insert into public.business_settings (
  default_service_tax_rate,
  default_parts_tax_rate
)
select 0, 0
where not exists (
  select 1 from public.business_settings
);