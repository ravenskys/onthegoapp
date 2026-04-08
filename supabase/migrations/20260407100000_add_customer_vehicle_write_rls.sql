drop policy if exists "vehicles_insert_customer_own" on public.vehicles;
create policy "vehicles_insert_customer_own"
on public.vehicles
for insert
to authenticated
with check (
  exists (
    select 1
    from public.customers c
    where c.id = vehicles.customer_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists "vehicles_update_customer_own" on public.vehicles;
create policy "vehicles_update_customer_own"
on public.vehicles
for update
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = vehicles.customer_id
      and c.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.customers c
    where c.id = vehicles.customer_id
      and c.auth_user_id = auth.uid()
  )
);
