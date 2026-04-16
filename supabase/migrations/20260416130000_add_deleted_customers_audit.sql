create table if not exists public.deleted_customers_audit (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  customer_name text,
  customer_email text,
  customer_phone text,
  vehicle_count integer not null default 0,
  address_count integer not null default 0,
  inspection_count integer not null default 0,
  deleted_by_user_id uuid references auth.users(id) on delete set null,
  deleted_by_name text,
  deleted_by_email text,
  deletion_reason text,
  deleted_at timestamptz not null default now(),
  customer_snapshot jsonb not null default '{}'::jsonb
);

create index if not exists deleted_customers_audit_deleted_at_idx
  on public.deleted_customers_audit (deleted_at desc);

create index if not exists deleted_customers_audit_customer_id_idx
  on public.deleted_customers_audit (customer_id);

alter table public.deleted_customers_audit enable row level security;

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

create or replace function public.delete_customer_with_audit(
  p_customer_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  has_internal_access boolean;
  target_customer public.customers%rowtype;
  deleter_name text;
  deleter_email text;
  related_vehicle_count integer := 0;
  related_address_count integer := 0;
  related_inspection_count integer := 0;
begin
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('manager', 'admin')
  )
  into has_internal_access;

  if not has_internal_access then
    raise exception 'You are not allowed to delete customers.'
      using errcode = '42501';
  end if;

  select *
  into target_customer
  from public.customers
  where id = p_customer_id;

  if not found then
    raise exception 'Customer not found.'
      using errcode = 'P0002';
  end if;

  select
    nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
    p.email
  into deleter_name, deleter_email
  from public.profiles p
  where p.id = auth.uid();

  if deleter_email is null then
    select u.email
    into deleter_email
    from auth.users u
    where u.id = auth.uid();
  end if;

  select count(*) into related_vehicle_count
  from public.vehicles v
  where v.customer_id = p_customer_id;

  select count(*) into related_address_count
  from public.customer_addresses ca
  where ca.customer_id = p_customer_id;

  select count(*) into related_inspection_count
  from public.inspections i
  where i.customer_id = p_customer_id;

  insert into public.deleted_customers_audit (
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    vehicle_count,
    address_count,
    inspection_count,
    deleted_by_user_id,
    deleted_by_name,
    deleted_by_email,
    deletion_reason,
    customer_snapshot
  )
  values (
    target_customer.id,
    nullif(trim(concat_ws(' ', target_customer.first_name, target_customer.last_name)), ''),
    target_customer.email,
    target_customer.phone,
    related_vehicle_count,
    related_address_count,
    related_inspection_count,
    auth.uid(),
    deleter_name,
    deleter_email,
    nullif(trim(p_reason), ''),
    to_jsonb(target_customer)
  );

  delete from public.customers
  where id = p_customer_id;
end;
$$;

grant execute on function public.delete_customer_with_audit(uuid, text) to authenticated;
