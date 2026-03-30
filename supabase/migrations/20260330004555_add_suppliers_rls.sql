alter table public.suppliers enable row level security;

drop policy if exists "suppliers_select_internal" on public.suppliers;

create policy "suppliers_select_internal"
on public.suppliers
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