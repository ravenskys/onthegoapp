with seed (
  service_code,
  service_name,
  service_description,
  category,
  default_duration_minutes,
  is_active,
  is_bookable_online,
  sort_order
) as (
  values
    ('oil_change', 'Oil Change', 'Drain and refill engine oil, replace the oil filter, and perform a basic visual under-hood check.', 'Maintenance', 30, true, true, 10),
    ('inspection', 'Inspection', 'Comprehensive vehicle inspection with condition reporting, safety checks, and maintenance recommendations.', 'Inspection', 45, true, true, 20),
    ('oil_change_and_inspection', 'Oil Change and Inspection', 'Combine an oil change with a full inspection and maintenance review.', 'Maintenance', 90, true, true, 30),
    ('repair_other', 'Repair / Other', 'General repair request or custom service that needs follow-up scheduling.', 'Repair', null, true, true, 40),
    ('tire_rotation', 'Tire Rotation', 'Rotate tires, inspect tread wear, and verify tire condition.', 'Maintenance', 30, true, false, 50),
    ('brake_service', 'Brake Service', 'Inspect brake pads and rotors, replace worn brake components, and service the brake system as needed.', 'Brakes', 120, true, false, 60),
    ('brake_fluid_service', 'Brake Fluid Service', 'Inspect, flush, and refill brake fluid to help maintain safe braking performance.', 'Brakes', 60, true, false, 70),
    ('coolant_flush', 'Radiator / Coolant Flush', 'Drain, flush, and refill the cooling system with the correct coolant mixture.', 'Fluids', 90, true, false, 80),
    ('transmission_fluid_service', 'Transmission Fluid Service', 'Service transmission fluid and related components based on vehicle condition and manufacturer guidance.', 'Fluids', 90, true, false, 90),
    ('power_steering_service', 'Power Steering Fluid Service', 'Inspect and service the power steering fluid and system condition.', 'Fluids', 60, true, false, 100),
    ('differential_service', 'Differential Fluid Service', 'Drain and refill differential fluid based on service interval and condition.', 'Fluids', 60, true, false, 110),
    ('belt_replacement', 'Belt Replacement', 'Inspect and replace worn drive belts such as serpentine belts.', 'Engine', 90, true, false, 120),
    ('tune_up', 'Tune Up', 'General tune-up service including ignition component checks and replacement as applicable.', 'Engine', 120, true, false, 130),
    ('spark_plug_service', 'Spark Plug Service', 'Inspect and replace spark plugs and related ignition components as needed.', 'Engine', 120, true, false, 140),
    ('battery_service', 'Battery / Charging System Service', 'Test the battery and charging system, clean terminals, and replace the battery if needed.', 'Electrical', 45, true, false, 150),
    ('air_filter_service', 'Engine Air Filter Service', 'Inspect and replace the engine air filter if needed.', 'Maintenance', 30, true, false, 160),
    ('cabin_filter_service', 'Cabin Air Filter Service', 'Inspect and replace the cabin air filter if needed.', 'Maintenance', 30, true, false, 170),
    ('fuel_system_service', 'Fuel System Service', 'Service fuel system components and treatments to address drivability and maintenance needs.', 'Fuel', 90, true, false, 180),
    ('wiper_blade_service', 'Wiper Blade Service', 'Inspect and replace worn wiper blades to improve visibility and safety.', 'Maintenance', 15, true, false, 190),
    ('ac_performance_service', 'A/C Performance Service', 'Inspect A/C operation, check system performance, and recommend further service if needed.', 'Climate', 60, true, false, 200)
),
updated as (
  update public.service_catalog as catalog
  set
    service_name = seed.service_name,
    service_description = seed.service_description,
    category = seed.category,
    default_duration_minutes = seed.default_duration_minutes,
    is_active = seed.is_active,
    is_bookable_online = seed.is_bookable_online,
    sort_order = seed.sort_order
  from seed
  where catalog.service_code = seed.service_code
  returning catalog.service_code
)
insert into public.service_catalog (
  service_code,
  service_name,
  service_description,
  category,
  default_duration_minutes,
  is_active,
  is_bookable_online,
  sort_order
)
select
  seed.service_code,
  seed.service_name,
  seed.service_description,
  seed.category,
  seed.default_duration_minutes,
  seed.is_active,
  seed.is_bookable_online,
  seed.sort_order
from seed
where not exists (
  select 1
  from public.service_catalog existing
  where existing.service_code = seed.service_code
);
