alter table public.job_checklists enable row level security;

create policy "customers can view their own job checklists"
on public.job_checklists
for select
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    join public.customers c on c.id = j.customer_id
    where j.id = job_checklists.job_id
      and c.auth_user_id = auth.uid()
  )
);

create policy "technicians can view job-related checklists"
on public.job_checklists
for select
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    where j.id = job_checklists.job_id
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

create policy "technicians can insert job-related checklists"
on public.job_checklists
for insert
to authenticated
with check (
  exists (
    select 1
    from public.jobs j
    where j.id = job_checklists.job_id
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

create policy "technicians can update job-related checklists"
on public.job_checklists
for update
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    where j.id = job_checklists.job_id
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
    where j.id = job_checklists.job_id
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

create policy "managers and admins can view all job checklists"
on public.job_checklists
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

create policy "managers and admins can insert all job checklists"
on public.job_checklists
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

create policy "managers and admins can update all job checklists"
on public.job_checklists
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