drop policy if exists "customers_delete_internal_roles_v2" on public.customers;
create policy "customers_delete_internal_roles_v2"
on public.customers
for delete
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager')
  )
);
