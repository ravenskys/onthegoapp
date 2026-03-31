alter table public.estimate_line_items enable row level security;

drop policy if exists "estimate_line_items_select_internal" on public.estimate_line_items;
drop policy if exists "estimate_line_items_insert_internal" on public.estimate_line_items;
drop policy if exists "estimate_line_items_update_internal" on public.estimate_line_items;
drop policy if exists "estimate_line_items_delete_internal" on public.estimate_line_items;

create policy "estimate_line_items_select_internal"
on public.estimate_line_items
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

create policy "estimate_line_items_insert_internal"
on public.estimate_line_items
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

create policy "estimate_line_items_update_internal"
on public.estimate_line_items
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

create policy "estimate_line_items_delete_internal"
on public.estimate_line_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager', 'technician')
  )
);