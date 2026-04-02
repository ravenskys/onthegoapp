alter table public.business_settings enable row level security;

drop policy if exists "business_settings_select_internal" on public.business_settings;
drop policy if exists "business_settings_update_internal" on public.business_settings;

create policy "business_settings_select_internal"
on public.business_settings
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

create policy "business_settings_update_internal"
on public.business_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager')
  )
);