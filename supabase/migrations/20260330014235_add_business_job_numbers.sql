alter table public.customers
add column if not exists customer_number integer;

alter table public.vehicles
add column if not exists vehicle_number integer;

alter table public.jobs
add column if not exists service_number integer,
add column if not exists business_job_number text;

create unique index if not exists customers_customer_number_key
on public.customers (customer_number)
where customer_number is not null;

create unique index if not exists vehicles_customer_vehicle_number_key
on public.vehicles (customer_id, vehicle_number)
where vehicle_number is not null;

create unique index if not exists jobs_customer_vehicle_service_number_key
on public.jobs (customer_id, vehicle_id, service_number)
where service_number is not null;

create unique index if not exists jobs_business_job_number_key
on public.jobs (business_job_number)
where business_job_number is not null;