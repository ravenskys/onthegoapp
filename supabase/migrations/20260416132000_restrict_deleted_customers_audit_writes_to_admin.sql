drop policy if exists "managers and admins can view deleted customers audit" on public.deleted_customers_audit;
create policy "managers and admins can view deleted customers audit"
on public.deleted_customers_audit
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

drop policy if exists "admins can insert deleted customers audit" on public.deleted_customers_audit;
create policy "admins can insert deleted customers audit"
on public.deleted_customers_audit
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

drop policy if exists "admins can update deleted customers audit" on public.deleted_customers_audit;
create policy "admins can update deleted customers audit"
on public.deleted_customers_audit
for update
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

drop policy if exists "admins can delete deleted customers audit" on public.deleted_customers_audit;
create policy "admins can delete deleted customers audit"
on public.deleted_customers_audit
for delete
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);
