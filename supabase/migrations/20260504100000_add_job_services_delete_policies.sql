alter table public.job_services enable row level security;

drop policy if exists "technicians can delete job-related services" on public.job_services;
create policy "technicians can delete job-related services"
on public.job_services
for delete
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

drop policy if exists "managers and admins can delete all job services" on public.job_services;
create policy "managers and admins can delete all job services"
on public.job_services
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
