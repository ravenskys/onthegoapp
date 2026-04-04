revoke all on table public.customers from anon, public;
revoke all on table public.vehicles from anon, public;
revoke all on table public.inspections from anon, public;
revoke all on table public.inspection_photos from anon, public;
revoke all on table public.inspection_reports from anon, public;
revoke all on table public.profiles from anon, public;
revoke all on table public.user_roles from anon, public;

alter table public.customers enable row level security;
alter table public.customers force row level security;
alter table public.vehicles enable row level security;
alter table public.vehicles force row level security;
alter table public.inspections enable row level security;
alter table public.inspections force row level security;
alter table public.inspection_photos enable row level security;
alter table public.inspection_photos force row level security;
alter table public.inspection_reports enable row level security;
alter table public.inspection_reports force row level security;
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.user_roles enable row level security;
alter table public.user_roles force row level security;

drop policy if exists "customers_select_self_or_claimable" on public.customers;
create policy "customers_select_self_or_claimable"
on public.customers
for select
to authenticated
using (
  auth_user_id = auth.uid()
  or (
    auth_user_id is null
    and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists "customers_insert_self" on public.customers;
create policy "customers_insert_self"
on public.customers
for insert
to authenticated
with check (
  auth_user_id = auth.uid()
  and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "customers_update_self_or_claimable" on public.customers;
create policy "customers_update_self_or_claimable"
on public.customers
for update
to authenticated
using (
  auth_user_id = auth.uid()
  or (
    auth_user_id is null
    and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
)
with check (
  auth_user_id = auth.uid()
  and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "vehicles_select_customer_own" on public.vehicles;
create policy "vehicles_select_customer_own"
on public.vehicles
for select
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = vehicles.customer_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists "inspections_select_customer_own" on public.inspections;
create policy "inspections_select_customer_own"
on public.inspections
for select
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = inspections.customer_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists "inspection_photos_select_customer_own" on public.inspection_photos;
create policy "inspection_photos_select_customer_own"
on public.inspection_photos
for select
to authenticated
using (
  exists (
    select 1
    from public.inspections i
    join public.customers c on c.id = i.customer_id
    where i.id = inspection_photos.inspection_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists "inspection_photos_select_internal" on public.inspection_photos;
create policy "inspection_photos_select_internal"
on public.inspection_photos
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

drop policy if exists "inspection_photos_insert_internal" on public.inspection_photos;
create policy "inspection_photos_insert_internal"
on public.inspection_photos
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

drop policy if exists "inspection_photos_update_internal" on public.inspection_photos;
create policy "inspection_photos_update_internal"
on public.inspection_photos
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

drop policy if exists "inspection_reports_select_customer_own" on public.inspection_reports;
create policy "inspection_reports_select_customer_own"
on public.inspection_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = inspection_reports.customer_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists "inspection_reports_select_internal" on public.inspection_reports;
create policy "inspection_reports_select_internal"
on public.inspection_reports
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

drop policy if exists "inspection_reports_insert_internal" on public.inspection_reports;
create policy "inspection_reports_insert_internal"
on public.inspection_reports
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

drop policy if exists "inspection_reports_update_internal" on public.inspection_reports;
create policy "inspection_reports_update_internal"
on public.inspection_reports
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

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_select_internal" on public.profiles;
create policy "profiles_select_internal"
on public.profiles
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

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "user_roles_select_self" on public.user_roles;
create policy "user_roles_select_self"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "user_roles_select_internal" on public.user_roles;
create policy "user_roles_select_internal"
on public.user_roles
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

drop policy if exists "user_roles_insert_self_customer" on public.user_roles;
create policy "user_roles_insert_self_customer"
on public.user_roles
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'customer'
);

drop policy if exists "user_roles_update_self_customer" on public.user_roles;
create policy "user_roles_update_self_customer"
on public.user_roles
for update
to authenticated
using (
  user_id = auth.uid()
  and role = 'customer'
)
with check (
  user_id = auth.uid()
  and role = 'customer'
);

update storage.buckets
set public = false
where id in ('inspection-photos', 'inspection-reports');

drop policy if exists "inspection_photos_storage_select_customer_own" on storage.objects;
create policy "inspection_photos_storage_select_customer_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'inspection-photos'
  and exists (
    select 1
    from public.inspections i
    join public.customers c on c.id = i.customer_id
    where i.id::text = split_part(name, '/', 1)
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists "inspection_photos_storage_internal_all" on storage.objects;
create policy "inspection_photos_storage_internal_all"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'inspection-photos'
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager', 'technician')
  )
)
with check (
  bucket_id = 'inspection-photos'
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager', 'technician')
  )
);

drop policy if exists "inspection_reports_storage_select_customer_own" on storage.objects;
create policy "inspection_reports_storage_select_customer_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'inspection-reports'
  and exists (
    select 1
    from public.customers c
    where c.id::text = split_part(name, '/', 1)
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists "inspection_reports_storage_internal_all" on storage.objects;
create policy "inspection_reports_storage_internal_all"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'inspection-reports'
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager', 'technician')
  )
)
with check (
  bucket_id = 'inspection-reports'
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager', 'technician')
  )
);
