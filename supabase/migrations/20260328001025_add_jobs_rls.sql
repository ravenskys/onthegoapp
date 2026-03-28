alter table public.jobs enable row level security;

create policy "customers can view their own jobs"
on public.jobs
for select
to authenticated
using (
  customer_id in (
    select c.id
    from public.customers c
    where c.auth_user_id = auth.uid()
  )
);

create policy "technicians can view assigned jobs"
on public.jobs
for select
to authenticated
using (
  assigned_tech_user_id = auth.uid()
  or exists (
    select 1
    from public.job_assignments ja
    where ja.job_id = jobs.id
      and ja.technician_user_id = auth.uid()
  )
);

create policy "managers and admins can view all jobs"
on public.jobs
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

create policy "managers and admins can insert jobs"
on public.jobs
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

create policy "managers admins and assigned technicians can update jobs"
on public.jobs
for update
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('manager', 'admin')
  )
  or assigned_tech_user_id = auth.uid()
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('manager', 'admin')
  )
  or assigned_tech_user_id = auth.uid()
);