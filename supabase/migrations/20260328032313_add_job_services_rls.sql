alter table public.job_services enable row level security;

create policy "customers can view their own job services"
on public.job_services
for select
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    join public.customers c on c.id = j.customer_id
    where j.id = job_services.job_id
      and c.auth_user_id = auth.uid()
  )
);

create policy "technicians can view job-related services"
on public.job_services
for select
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    where j.id = job_services.job_id
      and (
        j.assigned_tech_user_id = auth.uid()
        or exists (
          select 1
          from public.job_assignments ja
          where ja.job_id = j.id
            and ja.technician_user_id = auth.uid()
        )
      )
  )
);

create policy "technicians can insert job-related services"
on public.job_services
for insert
to authenticated
with check (
  exists (
    select 1
    from public.jobs j
    where j.id = job_services.job_id
      and (
        j.assigned_tech_user_id = auth.uid()
        or exists (
          select 1
          from public.job_assignments ja
          where ja.job_id = j.id
            and ja.technician_user_id = auth.uid()
        )
      )
  )
);

create policy "technicians can update job-related services"
on public.job_services
for update
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    where j.id = job_services.job_id
      and (
        j.assigned_tech_user_id = auth.uid()
        or exists (
          select 1
          from public.job_assignments ja
          where ja.job_id = j.id
            and ja.technician_user_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.jobs j
    where j.id = job_services.job_id
      and (
        j.assigned_tech_user_id = auth.uid()
        or exists (
          select 1
          from public.job_assignments ja
          where ja.job_id = j.id
            and ja.technician_user_id = auth.uid()
        )
      )
  )
);

create policy "managers and admins can view all job services"
on public.job_services
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

create policy "managers and admins can insert all job services"
on public.job_services
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

create policy "managers and admins can update all job services"
on public.job_services
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