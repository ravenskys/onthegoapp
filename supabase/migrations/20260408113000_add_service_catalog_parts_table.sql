create table if not exists public.service_catalog_parts (
  id uuid primary key default gen_random_uuid(),
  service_catalog_id uuid not null references public.service_catalog(id) on delete cascade,
  part_name text not null,
  default_quantity numeric(10,2) not null default 1,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.service_catalog_parts enable row level security;

drop policy if exists "managers and admins can view service catalog parts" on public.service_catalog_parts;
create policy "managers and admins can view service catalog parts"
on public.service_catalog_parts
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

drop policy if exists "managers and admins can insert service catalog parts" on public.service_catalog_parts;
create policy "managers and admins can insert service catalog parts"
on public.service_catalog_parts
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

drop policy if exists "managers and admins can update service catalog parts" on public.service_catalog_parts;
create policy "managers and admins can update service catalog parts"
on public.service_catalog_parts
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

drop policy if exists "managers and admins can delete service catalog parts" on public.service_catalog_parts;
create policy "managers and admins can delete service catalog parts"
on public.service_catalog_parts
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

insert into public.service_catalog_parts (service_catalog_id, part_name, default_quantity, notes, sort_order)
select catalog.id, seed.part_name, seed.default_quantity, seed.notes, seed.sort_order
from public.service_catalog catalog
join (
  values
    ('oil_change', 'Engine Oil', 1::numeric, 'Use the correct oil type and quantity for the vehicle.', 0),
    ('oil_change', 'Oil Filter', 1::numeric, 'Match filter to engine application.', 1),
    ('oil_change', 'Drain Plug Gasket / Washer', 1::numeric, 'Replace sealing washer if applicable.', 2),
    ('oil_change_and_inspection', 'Engine Oil', 1::numeric, 'Use the correct oil type and quantity for the vehicle.', 0),
    ('oil_change_and_inspection', 'Oil Filter', 1::numeric, 'Match filter to engine application.', 1),
    ('oil_change_and_inspection', 'Drain Plug Gasket / Washer', 1::numeric, 'Replace sealing washer if applicable.', 2),
    ('brake_service', 'Brake Pads Set', 1::numeric, 'Confirm front or rear application before ordering.', 0),
    ('brake_service', 'Brake Rotors', 2::numeric, 'Machine or replace as needed based on inspection.', 1),
    ('brake_service', 'Brake Hardware Kit', 1::numeric, 'Use the correct hardware kit for the axle serviced.', 2),
    ('brake_fluid_service', 'Brake Fluid', 1::numeric, 'Use the manufacturer-specified brake fluid type.', 0),
    ('coolant_flush', 'Coolant', 1::numeric, 'Use the correct coolant specification and quantity.', 0),
    ('transmission_fluid_service', 'Transmission Fluid', 1::numeric, 'Verify transmission type and fluid spec before ordering.', 0),
    ('transmission_fluid_service', 'Transmission Filter / Gasket', 1::numeric, 'If applicable for the transmission design.', 1),
    ('power_steering_service', 'Power Steering Fluid', 1::numeric, 'Use the correct power steering fluid for the application.', 0),
    ('differential_service', 'Differential Fluid', 1::numeric, 'Use the correct gear oil and friction modifier if required.', 0),
    ('differential_service', 'Differential Gasket / Sealant', 1::numeric, 'Confirm gasket or sealant requirement before ordering.', 1),
    ('belt_replacement', 'Serpentine Belt', 1::numeric, 'Match belt length and rib count to application.', 0),
    ('tune_up', 'Spark Plugs', 1::numeric, 'Quantity depends on engine cylinder count.', 0),
    ('tune_up', 'Ignition Coils / Boots', 1::numeric, 'Replace only as needed based on diagnosis and application.', 1),
    ('spark_plug_service', 'Spark Plugs', 1::numeric, 'Quantity depends on engine cylinder count.', 0),
    ('battery_service', 'Battery', 1::numeric, 'Confirm group size, CCA, and warranty level.', 0),
    ('air_filter_service', 'Engine Air Filter', 1::numeric, 'Match filter to intake housing and engine.', 0),
    ('cabin_filter_service', 'Cabin Air Filter', 1::numeric, 'Match filter style to HVAC housing.', 0),
    ('fuel_system_service', 'Fuel System Cleaner / Kit', 1::numeric, 'Use the product required for the service performed.', 0),
    ('wiper_blade_service', 'Front Wiper Blade Set', 1::numeric, 'Confirm blade lengths and attachment style.', 0),
    ('wiper_blade_service', 'Rear Wiper Blade', 1::numeric, 'Only if equipped.', 1),
    ('ac_performance_service', 'A/C Refrigerant / Service Materials', 1::numeric, 'Verify refrigerant type and required shop materials.', 0)
) as seed (service_code, part_name, default_quantity, notes, sort_order)
  on catalog.service_code = seed.service_code
where not exists (
  select 1
  from public.service_catalog_parts existing
  where existing.service_catalog_id = catalog.id
    and lower(existing.part_name) = lower(seed.part_name)
);
