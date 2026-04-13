-- Drum brake service: 180 minutes labor, parallel to disc-style brake jobs in the catalog.
insert into public.service_catalog (
  service_code,
  service_name,
  service_description,
  category,
  default_duration_minutes,
  default_price,
  default_cost,
  is_active,
  is_bookable_online,
  sort_order
)
select
  'drum_brake_service',
  'Drum Brake Service',
  'Inspect drum brake assemblies, replace shoes and hardware as needed, machine or replace drums, adjust the parking brake, and verify safe brake operation.',
  'Brakes',
  180,
  round((180::numeric / 60.0) * 120.0, 2),
  round((180::numeric / 60.0) * 30.0, 2),
  true,
  false,
  61
where not exists (
  select 1
  from public.service_catalog existing
  where existing.service_code = 'drum_brake_service'
);

insert into public.service_catalog_parts (service_catalog_id, part_name, default_quantity, notes, sort_order)
select catalog.id, seed.part_name, seed.default_quantity, seed.notes, seed.sort_order
from public.service_catalog catalog
join (
  values
    ('drum_brake_service', 'Brake Shoes Set', 1::numeric, 'Confirm axle and drum application before ordering replacement shoes.', 0),
    ('drum_brake_service', 'Brake Drums', 2::numeric, 'Machine or replace based on diameter, scoring, and wear limits.', 1),
    ('drum_brake_service', 'Drum Brake Hardware Kit', 1::numeric, 'Springs, retainers, adjusters—use the correct kit for the axle serviced.', 2)
) as seed (service_code, part_name, default_quantity, notes, sort_order)
  on catalog.service_code = seed.service_code
where not exists (
  select 1
  from public.service_catalog_parts existing
  where existing.service_catalog_id = catalog.id
    and lower(existing.part_name) = lower(seed.part_name)
);
