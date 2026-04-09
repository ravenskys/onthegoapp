alter table public.job_services
  add column if not exists estimated_cost numeric(10,2);
