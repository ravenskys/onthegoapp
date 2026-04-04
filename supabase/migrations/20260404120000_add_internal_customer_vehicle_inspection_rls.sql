create policy "customers_select_internal_roles_v2"
on public.customers
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager', 'technician')
  )
);

create policy "customers_insert_internal_roles_v2"
on public.customers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager', 'technician')
  )
);

create policy "customers_update_internal_roles_v2"
on public.customers
for update
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager', 'technician')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager', 'technician')
  )
);

create policy "vehicles_select_internal_roles_v2"
on public.vehicles
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager', 'technician')
  )
);

create policy "vehicles_insert_internal_roles_v2"
on public.vehicles
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager', 'technician')
  )
);

create policy "vehicles_update_internal_roles_v2"
on public.vehicles
for update
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager', 'technician')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager', 'technician')
  )
);

create policy "inspections_select_internal_roles_v2"
on public.inspections
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager', 'technician')
  )
);

create policy "inspections_insert_internal_roles_v2"
on public.inspections
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager', 'technician')
  )
);

create policy "inspections_update_internal_roles_v2"
on public.inspections
for update
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager', 'technician')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager', 'technician')
  )
);
