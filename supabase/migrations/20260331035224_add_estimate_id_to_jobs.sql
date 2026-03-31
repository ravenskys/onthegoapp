alter table public.jobs
add column if not exists estimate_id uuid null;

alter table public.jobs
drop constraint if exists jobs_estimate_id_fkey;

alter table public.jobs
add constraint jobs_estimate_id_fkey
foreign key (estimate_id)
references public.estimates (id)
on delete set null;