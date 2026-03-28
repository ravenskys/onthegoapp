alter table public.job_assignments enable row level security;

create policy "technicians can view their own job assignments"
on public.job_assignments
for select
to authenticated
using (
  technician_user_id = auth.uid()
);

create policy "technicians can update their own job assignments"
on public.job_assignments
for update
to authenticated
using (
  technician_user_id = auth.uid()
)
with check (
  technician_user_id = auth.uid()
);

create policy "managers and admins can view all job assignments"
on public.job_assignments
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

create policy "managers and admins can insert all job assignments"
on public.job_assignments
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

create policy "managers and admins can update all job assignments"
on public.job_assignments
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