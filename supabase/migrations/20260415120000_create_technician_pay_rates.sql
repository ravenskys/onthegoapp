-- Hourly pay by technician with effective dating (for labor cost / margin).

create table if not exists public.technician_pay_rates (
  id uuid primary key default gen_random_uuid(),
  technician_user_id uuid not null references auth.users (id) on delete cascade,
  hourly_pay numeric(10, 2) not null,
  effective_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint technician_pay_rates_hourly_pay_non_negative check (hourly_pay >= 0),
  constraint technician_pay_rates_technician_effective_unique unique (technician_user_id, effective_date)
);

create index if not exists technician_pay_rates_tech_effective_desc_idx
  on public.technician_pay_rates (technician_user_id, effective_date desc);

drop trigger if exists set_technician_pay_rates_updated_at on public.technician_pay_rates;
create trigger set_technician_pay_rates_updated_at
before update on public.technician_pay_rates
for each row
execute function public.set_updated_at();

alter table public.technician_pay_rates enable row level security;

create policy "managers and admins can view technician pay rates"
on public.technician_pay_rates
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('manager', 'admin')
  )
);

create policy "managers and admins can insert technician pay rates"
on public.technician_pay_rates
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('manager', 'admin')
  )
);

create policy "managers and admins can update technician pay rates"
on public.technician_pay_rates
for update
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('manager', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('manager', 'admin')
  )
);

create policy "managers and admins can delete technician pay rates"
on public.technician_pay_rates
for delete
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('manager', 'admin')
  )
);

grant select, insert, update, delete on table public.technician_pay_rates to authenticated;
