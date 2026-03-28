alter table public.service_requests enable row level security;

create policy "customers can view their own service requests"
on public.service_requests
for select
to authenticated
using (
  customer_id in (
    select c.id
    from public.customers c
    where c.auth_user_id = auth.uid()
  )
);

create policy "customers can create their own service requests"
on public.service_requests
for insert
to authenticated
with check (
  customer_id in (
    select c.id
    from public.customers c
    where c.auth_user_id = auth.uid()
  )
);

create policy "managers and admins can view all service requests"
on public.service_requests
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

create policy "managers and admins can update all service requests"
on public.service_requests
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