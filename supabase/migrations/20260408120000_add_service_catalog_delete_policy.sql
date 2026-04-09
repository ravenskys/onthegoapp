drop policy if exists "managers and admins can delete service catalog" on public.service_catalog;

create policy "managers and admins can delete service catalog"
on public.service_catalog
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
