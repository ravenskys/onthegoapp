drop function if exists public.create_customer_unscheduled_job_request(uuid, text, text, text, text, text, text, text, text);

create or replace function public.create_customer_unscheduled_job_request(
  p_vehicle_id uuid,
  p_service_type text,
  p_service_description text default null,
  p_notes text default null,
  p_service_location_name text default null,
  p_service_address text default null,
  p_service_city text default null,
  p_service_state text default null,
  p_service_zip text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_job_id uuid;
begin
  if v_auth_user_id is null then
    raise exception 'You must be logged in to request service.';
  end if;

  select customer.id
  into v_customer_id
  from public.customers customer
  where customer.auth_user_id = v_auth_user_id
  limit 1;

  if v_customer_id is null then
    raise exception 'No customer record is linked to this portal account.';
  end if;

  if not exists (
    select 1
    from public.vehicles vehicle
    where vehicle.id = p_vehicle_id
      and vehicle.customer_id = v_customer_id
  ) then
    raise exception 'The selected vehicle is not linked to this customer account.';
  end if;

  insert into public.jobs (
    customer_id,
    vehicle_id,
    status,
    priority,
    service_type,
    service_description,
    source,
    requested_date,
    created_by_user_id,
    notes,
    service_location_name,
    service_address,
    service_city,
    service_state,
    service_zip
  )
  values (
    v_customer_id,
    p_vehicle_id,
    'new_request',
    'normal',
    coalesce(nullif(trim(p_service_type), ''), 'repair_other'),
    nullif(trim(coalesce(p_service_description, '')), ''),
    'customer_portal',
    current_date,
    v_auth_user_id,
    nullif(trim(coalesce(p_notes, '')), ''),
    nullif(trim(coalesce(p_service_location_name, '')), ''),
    nullif(trim(coalesce(p_service_address, '')), ''),
    nullif(trim(coalesce(p_service_city, '')), ''),
    nullif(upper(trim(coalesce(p_service_state, ''))), ''),
    nullif(trim(coalesce(p_service_zip, '')), '')
  )
  returning id into v_job_id;

  return v_job_id;
end;
$$;

grant execute on function public.create_customer_unscheduled_job_request(uuid, text, text, text, text, text, text, text, text) to authenticated;
