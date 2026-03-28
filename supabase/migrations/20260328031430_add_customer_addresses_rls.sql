alter table public.customer_addresses enable row level security;

create policy "customers can view their own addresses"
on public.customer_addresses
for select
to authenticated
using (
  customer_id in (
    select c.id
    from public.customers c
    where c.auth_user_id = auth.uid()
  )
);

create policy "customers can insert their own addresses"
on public.customer_addresses
for insert
to authenticated
with check (
  customer_id in (
    select c.id
    from public.customers c
    where c.auth_user_id = auth.uid()
  )
);

create policy "customers can update their own addresses"
on public.customer_addresses
for update
to authenticated
using (
  customer_id in (
    select c.id
    from public.customers c
    where c.auth_user_id = auth.uid()
  )
)
with check (
  customer_id in (
    select c.id
    from public.customers c
    where c.auth_user_id = auth.uid()
  )
);

create policy "managers and admins can view all customer addresses"
on public.customer_addresses
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

create policy "managers and admins can insert all customer addresses"
on public.customer_addresses
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

create policy "managers and admins can update all customer addresses"
on public.customer_addresses
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