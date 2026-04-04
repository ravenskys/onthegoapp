do $$
declare
  preserve_count integer;
begin
  select count(*)
  into preserve_count
  from public.customers
  where lower(coalesce(first_name, '')) = 'mike'
    and lower(coalesce(last_name, '')) = 'sherman'
    and lower(coalesce(email, '')) in ('soaringmike@gmail.com', 'soaringmike@proton.me');

  if preserve_count = 0 then
    raise exception 'No customer matching Mike Sherman with soaringmike@gmail.com or soaringmike@proton.me was found. Aborting reset.';
  end if;
end
$$;

create temp table otg_preserve_customers on commit drop as
select id
from public.customers
where lower(coalesce(first_name, '')) = 'mike'
  and lower(coalesce(last_name, '')) = 'sherman'
  and lower(coalesce(email, '')) in ('soaringmike@gmail.com', 'soaringmike@proton.me');

update public.customers
set email = 'soaringmike@proton.me'
where id in (select id from otg_preserve_customers);

insert into public.user_roles (user_id, role)
select preserved.auth_user_id, roles.role
from (
  select auth_user_id
  from public.customers
  where id in (select id from otg_preserve_customers)
) preserved
cross join (
  values
    ('customer'),
    ('technician'),
    ('manager'),
    ('admin')
) as roles(role)
where preserved.auth_user_id is not null
on conflict (user_id, role) do nothing;

create temp table otg_doomed_customers on commit drop as
select id
from public.customers
where id not in (select id from otg_preserve_customers);

create temp table otg_doomed_vehicles on commit drop as
select id
from public.vehicles
where customer_id in (select id from otg_doomed_customers);

create temp table otg_doomed_jobs on commit drop as
select id
from public.jobs
where customer_id in (select id from otg_doomed_customers)
   or vehicle_id in (select id from otg_doomed_vehicles);

create temp table otg_doomed_estimates on commit drop as
select id
from public.estimates
where customer_id in (select id from otg_doomed_customers)
   or vehicle_id in (select id from otg_doomed_vehicles)
   or job_id in (select id from otg_doomed_jobs);

create temp table otg_doomed_invoices on commit drop as
select id
from public.invoices
where customer_id in (select id from otg_doomed_customers)
   or vehicle_id in (select id from otg_doomed_vehicles)
   or job_id in (select id from otg_doomed_jobs)
   or estimate_id in (select id from otg_doomed_estimates);

create temp table otg_doomed_inspections on commit drop as
select id
from public.inspections
where customer_id in (select id from otg_doomed_customers)
   or vehicle_id in (select id from otg_doomed_vehicles);

create temp table otg_doomed_service_requests on commit drop as
select id
from public.service_requests
where customer_id in (select id from otg_doomed_customers)
   or vehicle_id in (select id from otg_doomed_vehicles)
   or converted_to_job_id in (select id from otg_doomed_jobs);

create temp table otg_doomed_appointments on commit drop as
select id
from public.appointments
where customer_id in (select id from otg_doomed_customers)
   or vehicle_id in (select id from otg_doomed_vehicles)
   or job_id in (select id from otg_doomed_jobs)
   or service_request_id in (select id from otg_doomed_service_requests);

delete from public.inspection_photos
where inspection_id in (select id from otg_doomed_inspections);

delete from public.inspection_reports
where inspection_id in (select id from otg_doomed_inspections)
   or customer_id in (select id from otg_doomed_customers);

delete from public.invoice_line_items
where invoice_id in (select id from otg_doomed_invoices);

delete from public.estimate_line_items
where estimate_id in (select id from otg_doomed_estimates);

delete from public.customer_addresses
where customer_id in (select id from otg_doomed_customers);

delete from public.appointments
where id in (select id from otg_doomed_appointments);

delete from public.service_requests
where id in (select id from otg_doomed_service_requests);

delete from public.invoices
where id in (select id from otg_doomed_invoices);

delete from public.estimates
where id in (select id from otg_doomed_estimates);

delete from public.inspections
where id in (select id from otg_doomed_inspections);

delete from public.jobs
where id in (select id from otg_doomed_jobs);

delete from public.vehicles
where id in (select id from otg_doomed_vehicles);

delete from public.customers
where id in (select id from otg_doomed_customers);

create temp table otg_seed_users on commit drop as
select
  (
    select ur.user_id
    from public.user_roles ur
    where ur.role in ('admin', 'manager')
    order by case when ur.role = 'admin' then 0 else 1 end, ur.user_id
    limit 1
  ) as manager_user_id,
  (
    select ur.user_id
    from public.user_roles ur
    where ur.role = 'technician'
    order by ur.user_id
    limit 1
  ) as technician_user_id;

create temp table otg_test_seed (
  idx integer primary key,
  first_name text,
  last_name text,
  email text,
  phone text,
  tax_exempt boolean,
  address text,
  city text,
  state text,
  zip text,
  year integer,
  make text,
  model text,
  engine_size text,
  mileage integer,
  vin text,
  license_plate text,
  transmission text,
  driveline text,
  service_type text,
  priority text,
  job_status text,
  requested_service text
) on commit drop;

insert into otg_test_seed
select *
from jsonb_to_recordset(
  '[
    {"idx":1,"first_name":"Avery","last_name":"Stone","email":"avery.stone.test@otg.local","phone":"(208) 555-1001","tax_exempt":false,"address":"1451 Maple Ridge Dr","city":"Boise","state":"ID","zip":"83702","year":2021,"make":"Toyota","model":"Camry","engine_size":"2.5L I4","mileage":128450,"vin":"1HGBH41JXMN100001","license_plate":"AVR1001","transmission":"Automatic","driveline":"FWD","service_type":"Oil Change","priority":"normal","job_status":"new_request","requested_service":"Routine oil change and inspection"},
    {"idx":2,"first_name":"Jordan","last_name":"Reed","email":"jordan.reed.test@otg.local","phone":"(208) 555-1002","tax_exempt":true,"address":"2217 Silver Pine Ave","city":"Meridian","state":"ID","zip":"83642","year":2019,"make":"Ford","model":"F-150","engine_size":"3.5L V6","mileage":167220,"vin":"1HGBH41JXMN100002","license_plate":"JRD1002","transmission":"Automatic","driveline":"4WD","service_type":"Inspection","priority":"high","job_status":"in_progress","requested_service":"Brake vibration and undercarriage inspection"},
    {"idx":3,"first_name":"Taylor","last_name":"Brooks","email":"taylor.brooks.test@otg.local","phone":"(208) 555-1003","tax_exempt":false,"address":"908 Canyon View Ln","city":"Nampa","state":"ID","zip":"83651","year":2020,"make":"Honda","model":"CR-V","engine_size":"1.5L I4 Turbo","mileage":101340,"vin":"1HGBH41JXMN100003","license_plate":"TBR1003","transmission":"CVT","driveline":"AWD","service_type":"Oil Change + Inspection","priority":"normal","job_status":"completed","requested_service":"Maintenance service before road trip"},
    {"idx":4,"first_name":"Morgan","last_name":"Price","email":"morgan.price.test@otg.local","phone":"(208) 555-1004","tax_exempt":false,"address":"3304 Falcon Crest Rd","city":"Eagle","state":"ID","zip":"83616","year":2018,"make":"Chevrolet","model":"Silverado 1500","engine_size":"5.3L V8","mileage":189510,"vin":"1HGBH41JXMN100004","license_plate":"MPR1004","transmission":"Automatic","driveline":"4WD","service_type":"Inspection","priority":"urgent","job_status":"new_request","requested_service":"Noise from front suspension and steering looseness"},
    {"idx":5,"first_name":"Casey","last_name":"Bennett","email":"casey.bennett.test@otg.local","phone":"(208) 555-1005","tax_exempt":false,"address":"557 Aspen Meadow Ct","city":"Kuna","state":"ID","zip":"83634","year":2022,"make":"Subaru","model":"Outback","engine_size":"2.5L H4","mileage":58440,"vin":"1HGBH41JXMN100005","license_plate":"CSB1005","transmission":"CVT","driveline":"AWD","service_type":"Oil Change","priority":"low","job_status":"in_progress","requested_service":"Routine service and fluid top-off"},
    {"idx":6,"first_name":"Riley","last_name":"Garcia","email":"riley.garcia.test@otg.local","phone":"(208) 555-1006","tax_exempt":true,"address":"7421 Westover St","city":"Boise","state":"ID","zip":"83709","year":2017,"make":"Ram","model":"2500","engine_size":"6.7L I6 Diesel","mileage":214775,"vin":"1HGBH41JXMN100006","license_plate":"RLG1006","transmission":"Automatic","driveline":"4WD","service_type":"Inspection","priority":"high","job_status":"completed","requested_service":"Fleet inspection for work truck"},
    {"idx":7,"first_name":"Parker","last_name":"Diaz","email":"parker.diaz.test@otg.local","phone":"(208) 555-1007","tax_exempt":false,"address":"1840 River Stone Loop","city":"Star","state":"ID","zip":"83669","year":2023,"make":"Hyundai","model":"Tucson","engine_size":"2.5L I4","mileage":18620,"vin":"1HGBH41JXMN100007","license_plate":"PKD1007","transmission":"Automatic","driveline":"AWD","service_type":"Oil Change + Inspection","priority":"normal","job_status":"new_request","requested_service":"First service interval with full inspection"},
    {"idx":8,"first_name":"Quinn","last_name":"Foster","email":"quinn.foster.test@otg.local","phone":"(208) 555-1008","tax_exempt":false,"address":"961 Orchard Park Way","city":"Caldwell","state":"ID","zip":"83605","year":2016,"make":"Jeep","model":"Grand Cherokee","engine_size":"3.6L V6","mileage":155980,"vin":"1HGBH41JXMN100008","license_plate":"QNF1008","transmission":"Automatic","driveline":"4WD","service_type":"Inspection","priority":"urgent","job_status":"new_request","requested_service":"Check engine light and oil seep inspection"},
    {"idx":9,"first_name":"Blake","last_name":"Turner","email":"blake.turner.test@otg.local","phone":"(208) 555-1009","tax_exempt":false,"address":"412 Brookfield Ave","city":"Boise","state":"ID","zip":"83704","year":2015,"make":"Nissan","model":"Altima","engine_size":"2.5L I4","mileage":173630,"vin":"1HGBH41JXMN100009","license_plate":"BLT1009","transmission":"CVT","driveline":"FWD","service_type":"Oil Change","priority":"low","job_status":"completed","requested_service":"Basic maintenance for commuter vehicle"},
    {"idx":10,"first_name":"Hayden","last_name":"Cole","email":"hayden.cole.test@otg.local","phone":"(208) 555-1010","tax_exempt":true,"address":"2661 Timberline Rd","city":"Meridian","state":"ID","zip":"83646","year":2024,"make":"Kia","model":"Telluride","engine_size":"3.8L V6","mileage":9430,"vin":"1HGBH41JXMN100010","license_plate":"HYC1010","transmission":"Automatic","driveline":"AWD","service_type":"Inspection","priority":"normal","job_status":"in_progress","requested_service":"Post-purchase inspection request"},
    {"idx":11,"first_name":"Dakota","last_name":"Murphy","email":"dakota.murphy.test@otg.local","phone":"(208) 555-1011","tax_exempt":false,"address":"715 Desert Sage Dr","city":"Nampa","state":"ID","zip":"83686","year":2014,"make":"BMW","model":"328i","engine_size":"2.0L I4 Turbo","mileage":146275,"vin":"1HGBH41JXMN100011","license_plate":"DKM1011","transmission":"Automatic","driveline":"RWD","service_type":"Oil Change + Inspection","priority":"high","job_status":"new_request","requested_service":"Leak check and overdue service"},
    {"idx":12,"first_name":"Emerson","last_name":"Hayes","email":"emerson.hayes.test@otg.local","phone":"(208) 555-1012","tax_exempt":false,"address":"522 Lakeview Dr","city":"Eagle","state":"ID","zip":"83616","year":2020,"make":"GMC","model":"Sierra 1500","engine_size":"5.3L V8","mileage":88490,"vin":"1HGBH41JXMN100012","license_plate":"EMH1012","transmission":"Automatic","driveline":"4WD","service_type":"Inspection","priority":"normal","job_status":"completed","requested_service":"Seasonal fleet safety inspection"},
    {"idx":13,"first_name":"Rowan","last_name":"Bell","email":"rowan.bell.test@otg.local","phone":"(208) 555-1013","tax_exempt":false,"address":"1809 Cedar Grove Ln","city":"Kuna","state":"ID","zip":"83634","year":2018,"make":"Mazda","model":"CX-5","engine_size":"2.5L I4","mileage":112560,"vin":"1HGBH41JXMN100013","license_plate":"RWB1013","transmission":"Automatic","driveline":"AWD","service_type":"Oil Change","priority":"normal","job_status":"in_progress","requested_service":"Oil service and tire condition check"},
    {"idx":14,"first_name":"Finley","last_name":"Ward","email":"finley.ward.test@otg.local","phone":"(208) 555-1014","tax_exempt":true,"address":"640 Willow Peak Ct","city":"Boise","state":"ID","zip":"83713","year":2019,"make":"Tesla","model":"Model 3","engine_size":"Electric","mileage":73420,"vin":"1HGBH41JXMN100014","license_plate":"FNW1014","transmission":"Single Speed","driveline":"RWD","service_type":"Inspection","priority":"low","job_status":"new_request","requested_service":"General condition inspection before resale"},
    {"idx":15,"first_name":"Sawyer","last_name":"Ross","email":"sawyer.ross.test@otg.local","phone":"(208) 555-1015","tax_exempt":false,"address":"2914 High Desert Ave","city":"Star","state":"ID","zip":"83669","year":2021,"make":"Chevrolet","model":"Tahoe","engine_size":"5.3L V8","mileage":69735,"vin":"1HGBH41JXMN100015","license_plate":"SWR1015","transmission":"Automatic","driveline":"4WD","service_type":"Oil Change + Inspection","priority":"high","job_status":"completed","requested_service":"Full service with family trip prep"}
  ]'::jsonb
) as seed(
  idx integer,
  first_name text,
  last_name text,
  email text,
  phone text,
  tax_exempt boolean,
  address text,
  city text,
  state text,
  zip text,
  year integer,
  make text,
  model text,
  engine_size text,
  mileage integer,
  vin text,
  license_plate text,
  transmission text,
  driveline text,
  service_type text,
  priority text,
  job_status text,
  requested_service text
);

insert into public.customers (
  first_name,
  last_name,
  email,
  phone,
  tax_exempt
)
select
  first_name,
  last_name,
  email,
  phone,
  tax_exempt
from otg_test_seed;

create temp table otg_inserted_customers on commit drop as
select
  s.*,
  c.id as customer_id
from otg_test_seed s
join public.customers c on c.email = s.email;

insert into public.customer_addresses (
  customer_id,
  address_type,
  is_default,
  label,
  contact_name,
  contact_phone,
  address,
  city,
  state,
  zip,
  parking_notes,
  service_notes
)
select
  ic.customer_id,
  'service',
  true,
  'Primary Service Address',
  ic.first_name || ' ' || ic.last_name,
  ic.phone,
  ic.address,
  ic.city,
  ic.state,
  ic.zip,
  'Mobile service okay in driveway.',
  'Seeded test customer service address.'
from otg_inserted_customers ic;

insert into public.vehicles (
  customer_id,
  year,
  make,
  model,
  mileage,
  vin,
  engine_size,
  license_plate,
  state,
  transmission,
  driveline
)
select
  ic.customer_id,
  ic.year,
  ic.make,
  ic.model,
  ic.mileage,
  ic.vin,
  ic.engine_size,
  ic.license_plate,
  ic.state,
  ic.transmission,
  ic.driveline
from otg_inserted_customers ic;

create temp table otg_inserted_vehicles on commit drop as
select
  ic.idx,
  v.id as vehicle_id
from otg_inserted_customers ic
join public.vehicles v on v.vin = ic.vin;

insert into public.service_requests (
  customer_id,
  vehicle_id,
  status,
  source,
  requested_service,
  service_details,
  preferred_date,
  preferred_time_window,
  address,
  city,
  state,
  zip,
  contact_name,
  contact_phone,
  contact_email,
  notes
)
select
  ic.customer_id,
  iv.vehicle_id,
  case when ic.job_status = 'completed' then 'closed' when ic.job_status = 'in_progress' then 'scheduled' else 'new' end,
  'manual',
  ic.requested_service,
  ic.requested_service || ' for seeded test customer.',
  current_date + ic.idx,
  'Morning',
  ic.address,
  ic.city,
  ic.state,
  ic.zip,
  ic.first_name || ' ' || ic.last_name,
  ic.phone,
  ic.email,
  'Seeded service request for UI testing.'
from otg_inserted_customers ic
join otg_inserted_vehicles iv on iv.idx = ic.idx;

create temp table otg_inserted_service_requests on commit drop as
select
  ic.idx,
  sr.id as service_request_id
from otg_inserted_customers ic
join public.service_requests sr on sr.contact_email = ic.email;

insert into public.jobs (
  customer_id,
  vehicle_id,
  status,
  priority,
  service_type,
  service_description,
  source,
  requested_date,
  scheduled_start,
  scheduled_end,
  assigned_tech_user_id,
  created_by_user_id,
  notes
)
select
  ic.customer_id,
  iv.vehicle_id,
  ic.job_status,
  ic.priority,
  ic.service_type,
  ic.requested_service || ' for ' || ic.make || ' ' || ic.model,
  'manual',
  current_date + ic.idx,
  now() + make_interval(days => ic.idx),
  now() + make_interval(days => ic.idx, hours => 2),
  su.technician_user_id,
  su.manager_user_id,
  'Seeded test job #' || ic.idx || ' created for page testing.'
from otg_inserted_customers ic
join otg_inserted_vehicles iv on iv.idx = ic.idx
cross join otg_seed_users su;

create temp table otg_inserted_jobs on commit drop as
select
  ic.idx,
  j.id as job_id,
  j.customer_id,
  j.vehicle_id
from otg_inserted_customers ic
join public.jobs j on j.notes = 'Seeded test job #' || ic.idx || ' created for page testing.';

insert into public.job_services (
  job_id,
  service_code,
  service_name,
  service_description,
  estimated_hours,
  estimated_price,
  sort_order,
  notes
)
select
  ij.job_id,
  'SVC-' || lpad(ic.idx::text, 3, '0') || '-A',
  ic.service_type,
  ic.requested_service,
  1.50 + (ic.idx % 3) * 0.5,
  89.00 + ic.idx,
  0,
  'Primary seeded service line.'
from otg_inserted_jobs ij
join otg_inserted_customers ic on ic.idx = ij.idx;

insert into public.job_services (
  job_id,
  service_code,
  service_name,
  service_description,
  estimated_hours,
  estimated_price,
  sort_order,
  notes
)
select
  ij.job_id,
  'SVC-' || lpad(ic.idx::text, 3, '0') || '-B',
  'Vehicle Inspection',
  'Multi-point inspection with technician notes and recommendations.',
  1.00,
  65.00,
  1,
  'Secondary seeded inspection line.'
from otg_inserted_jobs ij
join otg_inserted_customers ic on ic.idx = ij.idx;

insert into public.job_parts (
  job_id,
  part_name,
  part_number,
  quantity,
  unit_cost,
  unit_price,
  supplier,
  notes
)
select
  ij.job_id,
  'Premium Oil Filter',
  'OF-' || lpad(ic.idx::text, 4, '0'),
  1,
  8.50 + ic.idx,
  16.50 + ic.idx,
  'Seed Supplier',
  'Seeded filter part for job detail testing.'
from otg_inserted_jobs ij
join otg_inserted_customers ic on ic.idx = ij.idx;

insert into public.job_notes (
  job_id,
  created_by_user_id,
  note_type,
  note,
  is_pinned
)
select
  ij.job_id,
  su.manager_user_id,
  case when ic.idx % 2 = 0 then 'customer' else 'internal' end,
  'Seeded note for ' || ic.first_name || ' ' || ic.last_name || '. Review status, estimate, and service findings.',
  (ic.idx % 4 = 0)
from otg_inserted_jobs ij
join otg_inserted_customers ic on ic.idx = ij.idx
cross join otg_seed_users su;

insert into public.job_payments (
  job_id,
  payment_method,
  payment_status,
  amount,
  paid_at,
  reference_number,
  notes
)
select
  ij.job_id,
  case when ic.idx % 3 = 0 then 'card' else 'invoice' end,
  case when ic.job_status = 'completed' then 'paid' else 'pending' end,
  45.00 + ic.idx,
  case when ic.job_status = 'completed' then now() - make_interval(days => ic.idx) else null end,
  'PAY-' || lpad(ic.idx::text, 5, '0'),
  'Seeded payment record.'
from otg_inserted_jobs ij
join otg_inserted_customers ic on ic.idx = ij.idx;

insert into public.estimates (
  service_request_id,
  job_id,
  customer_id,
  vehicle_id,
  estimate_status,
  estimate_number,
  subtotal,
  tax_total,
  total_amount,
  valid_until,
  notes,
  created_by_user_id
)
select
  isr.service_request_id,
  ij.job_id,
  ij.customer_id,
  ij.vehicle_id,
  case when ic.job_status = 'completed' then 'approved' when ic.job_status = 'in_progress' then 'sent' else 'draft' end,
  'EST-' || to_char(1000 + ic.idx, 'FM0000'),
  185.00 + ic.idx * 6,
  case when ic.tax_exempt then 0 else round((185.00 + ic.idx * 6) * 0.06, 2) end,
  case when ic.tax_exempt then 185.00 + ic.idx * 6 else round((185.00 + ic.idx * 6) * 1.06, 2) end,
  current_date + 14,
  'Seeded estimate for customer workflow testing.',
  su.manager_user_id
from otg_inserted_jobs ij
join otg_inserted_customers ic on ic.idx = ij.idx
join otg_inserted_service_requests isr on isr.idx = ic.idx
cross join otg_seed_users su;

create temp table otg_inserted_estimates on commit drop as
select
  ij.idx,
  e.id as estimate_id
from otg_inserted_jobs ij
join public.estimates e on e.job_id = ij.job_id;

update public.jobs j
set estimate_id = ie.estimate_id
from otg_inserted_jobs ij
join otg_inserted_estimates ie on ie.idx = ij.idx
where j.id = ij.job_id;

insert into public.estimate_line_items (
  estimate_id,
  line_type,
  description,
  quantity,
  unit_price,
  unit_cost,
  taxable,
  sort_order,
  notes
)
select
  ie.estimate_id,
  'service',
  ic.service_type,
  1,
  120.00 + ic.idx,
  75.00 + ic.idx,
  true,
  0,
  'Primary seeded estimate line.'
from otg_inserted_estimates ie
join otg_inserted_customers ic on ic.idx = ie.idx;

insert into public.estimate_line_items (
  estimate_id,
  line_type,
  description,
  quantity,
  unit_price,
  unit_cost,
  taxable,
  sort_order,
  notes
)
select
  ie.estimate_id,
  'part',
  'Oil filter and shop supplies',
  1,
  28.00 + ic.idx,
  14.00 + ic.idx,
  true,
  1,
  'Seeded part estimate line.'
from otg_inserted_estimates ie
join otg_inserted_customers ic on ic.idx = ie.idx;

insert into public.invoices (
  estimate_id,
  job_id,
  customer_id,
  vehicle_id,
  invoice_status,
  invoice_number,
  subtotal,
  tax_total,
  total_amount,
  amount_paid,
  balance_due,
  issued_at,
  due_at,
  paid_in_full_at,
  notes,
  created_by_user_id
)
select
  ie.estimate_id,
  ij.job_id,
  ij.customer_id,
  ij.vehicle_id,
  case when ic.job_status = 'completed' then 'paid' when ic.job_status = 'in_progress' then 'sent' else 'draft' end,
  'INV-' || to_char(2000 + ic.idx, 'FM0000'),
  185.00 + ic.idx * 6,
  case when ic.tax_exempt then 0 else round((185.00 + ic.idx * 6) * 0.06, 2) end,
  case when ic.tax_exempt then 185.00 + ic.idx * 6 else round((185.00 + ic.idx * 6) * 1.06, 2) end,
  case when ic.job_status = 'completed' then case when ic.tax_exempt then 185.00 + ic.idx * 6 else round((185.00 + ic.idx * 6) * 1.06, 2) end else 0 end,
  case when ic.job_status = 'completed' then 0 else case when ic.tax_exempt then 185.00 + ic.idx * 6 else round((185.00 + ic.idx * 6) * 1.06, 2) end end,
  now() - make_interval(days => ic.idx),
  now() + make_interval(days => 15 - ic.idx),
  case when ic.job_status = 'completed' then now() - make_interval(days => greatest(ic.idx - 2, 0)) else null end,
  'Seeded invoice for billing tab testing.',
  su.manager_user_id
from otg_inserted_estimates ie
join otg_inserted_jobs ij on ij.idx = ie.idx
join otg_inserted_customers ic on ic.idx = ie.idx
cross join otg_seed_users su;

insert into public.inspections (
  customer_id,
  vehicle_id,
  tech_name,
  obd_code,
  notes,
  brakes,
  tire_data,
  maintenance,
  undercar,
  inspection_summary
)
select
  ij.customer_id,
  ij.vehicle_id,
  'Seed Technician',
  case when ic.idx % 4 = 0 then 'P0420' else null end,
  'Seeded inspection notes for ' || ic.make || ' ' || ic.model || '.',
  jsonb_build_object(
    'lfPad', greatest(2, 8 - (ic.idx % 5)),
    'rfPad', greatest(2, 8 - (ic.idx % 4)),
    'lrPad', greatest(2, 7 - (ic.idx % 3)),
    'rrPad', greatest(2, 7 - (ic.idx % 2)),
    'lfRotor', 'Good',
    'rfRotor', 'Good',
    'lrRotor', 'Monitor',
    'rrRotor', 'Monitor',
    'brakeNotes', 'Seeded brake notes.',
    'status', case when ic.idx % 5 = 0 then 'req' when ic.idx % 3 = 0 then 'sug' else 'ok' end
  ),
  jsonb_build_object(
    'Left Front', jsonb_build_object('psiIn', 32, 'psiOut', 35, 'treadOuter', 6, 'treadInner', 6, 'status', 'ok', 'flags', jsonb_build_array(), 'recommendation', ''),
    'Right Front', jsonb_build_object('psiIn', 31, 'psiOut', 35, 'treadOuter', 6, 'treadInner', 5, 'status', case when ic.idx % 4 = 0 then 'sug' else 'ok' end, 'flags', jsonb_build_array(), 'recommendation', 'Monitor wear'),
    'Right Rear', jsonb_build_object('psiIn', 30, 'psiOut', 34, 'treadOuter', 5, 'treadInner', 5, 'status', 'ok', 'flags', jsonb_build_array(), 'recommendation', ''),
    'Left Rear', jsonb_build_object('psiIn', 30, 'psiOut', 34, 'treadOuter', 5, 'treadInner', 5, 'status', 'ok', 'flags', jsonb_build_array(), 'recommendation', ''),
    'Spare', jsonb_build_object('psiIn', 60, 'psiOut', 60, 'treadOuter', 8, 'treadInner', 8, 'status', 'ok', 'flags', jsonb_build_array(), 'recommendation', '')
  ),
  jsonb_build_object(
    'Wiper Blades', jsonb_build_object('status', case when ic.idx % 4 = 0 then 'sug' else 'ok' end, 'why', 'Streaking noted'),
    'Oil Level', jsonb_build_object('status', 'ok', 'why', ''),
    'Battery Test', jsonb_build_object('status', case when ic.idx % 6 = 0 then 'req' else 'ok' end, 'why', 'Battery tested weak'),
    'Cabin Filter', jsonb_build_object('status', case when ic.idx % 3 = 0 then 'sug' else 'ok' end, 'why', 'Filter is dirty')
  ),
  jsonb_build_object(
    'Struts / Shocks', jsonb_build_object('status', case when ic.idx % 5 = 0 then 'sug' else 'ok' end, 'why', 'Minor seepage noted'),
    'Tie Rod Ends', jsonb_build_object('status', case when ic.idx % 4 = 0 then 'req' else 'ok' end, 'why', 'Play noted during inspection'),
    'Bushings', jsonb_build_object('status', 'ok', 'why', '')
  ),
  jsonb_build_object(
    'ok', 8,
    'suggested', case when ic.idx % 2 = 0 then 2 else 1 end,
    'required', case when ic.idx % 4 = 0 then 1 else 0 end,
    'workflow_steps', jsonb_build_object(
      'vehicle', true,
      'tires', true,
      'brakes', true,
      'maintenance', true,
      'photos', true,
      'customer-report', ic.job_status <> 'new_request',
      'review', ic.job_status = 'completed'
    ),
    'workflow_completed_count', case when ic.job_status = 'completed' then 7 when ic.job_status = 'in_progress' then 6 else 5 end,
    'workflow_total_count', 7
  )
from otg_inserted_jobs ij
join otg_inserted_customers ic on ic.idx = ij.idx;

create temp table otg_inserted_inspections on commit drop as
select
  ij.idx,
  i.id as inspection_id,
  ij.customer_id
from otg_inserted_jobs ij
join public.inspections i on i.customer_id = ij.customer_id and i.vehicle_id = ij.vehicle_id;

insert into public.inspection_photos (
  inspection_id,
  photo_stage,
  shot_label,
  file_name,
  file_url,
  note
)
select
  ii.inspection_id,
  'inspection',
  'Seeded overview photo',
  'seeded-' || ii.idx || '-overview.jpg',
  ii.inspection_id::text || '/inspection/seeded-overview-' || ii.idx || '.jpg',
  'Seeded placeholder photo record for UI testing.'
from otg_inserted_inspections ii;

insert into public.inspection_reports (
  inspection_id,
  customer_id,
  pdf_path
)
select
  ii.inspection_id,
  ii.customer_id,
  ii.customer_id::text || '/' || ii.inspection_id::text || '/seeded-report-' || ii.idx || '.pdf'
from otg_inserted_inspections ii;
