alter table public.jobs
  add column if not exists service_duration_minutes integer,
  add column if not exists travel_time_minutes integer,
  add column if not exists service_location_name text,
  add column if not exists service_address text,
  add column if not exists service_city text,
  add column if not exists service_state text,
  add column if not exists service_zip text;

drop function if exists public.get_customer_available_schedule_slots(timestamptz, timestamptz, integer);
drop function if exists public.get_customer_available_schedule_slots(timestamptz, timestamptz, integer, text, text, text);

create or replace function public.get_customer_available_schedule_slots(
  p_range_start timestamptz,
  p_range_end timestamptz,
  p_service_duration_minutes integer default 60,
  p_service_city text default null,
  p_service_state text default null,
  p_service_zip text default null
)
returns table (
  technician_user_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  travel_time_minutes integer
)
language sql
security definer
set search_path = public
as $$
  with service_config as (
    select
      greatest(15, least(coalesce(p_service_duration_minutes, 60), 480)) as service_minutes,
      make_interval(mins => greatest(15, least(coalesce(p_service_duration_minutes, 60), 480))) as service_duration,
      nullif(lower(trim(coalesce(p_service_city, ''))), '') as service_city,
      nullif(lower(trim(coalesce(p_service_state, ''))), '') as service_state,
      nullif(regexp_replace(coalesce(p_service_zip, ''), '[^0-9]', '', 'g'), '') as service_zip
  ),
  available_blocks as (
    select block.*
    from public.technician_schedule_blocks block
    where block.status = 'active'
      and block.block_type = 'available'
      and block.starts_at < p_range_end
      and block.ends_at > p_range_start
  ),
  candidate_slots as (
    select
      block.technician_user_id,
      slot_start as starts_at,
      block.ends_at as block_ends_at,
      config.service_duration,
      config.service_city,
      config.service_state,
      config.service_zip
    from available_blocks block
    cross join service_config config
    cross join lateral generate_series(
      greatest(block.starts_at, p_range_start),
      least(block.ends_at, p_range_end) - config.service_duration,
      config.service_duration
    ) as slot_start
  ),
  estimated_slots as (
    select
      slot.technician_user_id,
      slot.starts_at,
      (
        case
          when prior_job.id is null then 30
          when slot.service_zip is null and slot.service_city is null and slot.service_state is null then 30
          when slot.service_zip is not null
            and nullif(regexp_replace(coalesce(prior_job.service_zip, ''), '[^0-9]', '', 'g'), '') = slot.service_zip
            then 15
          when slot.service_city is not null
            and slot.service_state is not null
            and lower(coalesce(prior_job.service_city, '')) = slot.service_city
            and lower(coalesce(prior_job.service_state, '')) = slot.service_state
            then 25
          when slot.service_state is not null
            and lower(coalesce(prior_job.service_state, '')) = slot.service_state
            then 45
          else 60
        end
      ) as travel_time_minutes,
      slot.service_duration,
      slot.block_ends_at
    from candidate_slots slot
    left join lateral (
      select
        job.id,
        job.service_city,
        job.service_state,
        job.service_zip
      from public.jobs job
      where job.assigned_tech_user_id = slot.technician_user_id
        and job.scheduled_start is not null
        and job.status not in ('cancelled', 'completed')
        and job.scheduled_start < slot.starts_at
      order by coalesce(job.scheduled_end, job.scheduled_start) desc
      limit 1
    ) prior_job on true
  ),
  sized_slots as (
    select
      slot.technician_user_id,
      slot.starts_at,
      slot.starts_at + slot.service_duration + make_interval(mins => slot.travel_time_minutes) as ends_at,
      slot.travel_time_minutes,
      slot.service_duration,
      slot.block_ends_at
    from estimated_slots slot
  )
  select
    slot.technician_user_id,
    slot.starts_at,
    slot.ends_at,
    slot.travel_time_minutes
  from sized_slots slot
  where slot.ends_at <= slot.block_ends_at
  and slot.ends_at <= p_range_end
  and not exists (
    select 1
    from public.jobs job
    where job.assigned_tech_user_id = slot.technician_user_id
      and job.scheduled_start is not null
      and job.status not in ('cancelled', 'completed')
      and tstzrange(
        job.scheduled_start,
        coalesce(job.scheduled_end, job.scheduled_start + slot.service_duration),
        '[)'
      ) && tstzrange(slot.starts_at, slot.ends_at, '[)')
  )
  and not exists (
    select 1
    from public.appointments appointment
    where appointment.assigned_tech_user_id = slot.technician_user_id
      and appointment.appointment_status not in ('cancelled', 'completed')
      and tstzrange(
        appointment.scheduled_start,
        coalesce(appointment.scheduled_end, appointment.scheduled_start + slot.service_duration),
        '[)'
      ) && tstzrange(slot.starts_at, slot.ends_at, '[)')
  )
  order by slot.starts_at, slot.technician_user_id;
$$;

grant execute on function public.get_customer_available_schedule_slots(timestamptz, timestamptz, integer, text, text, text) to authenticated;

drop policy if exists "customers can view active available schedule blocks" on public.technician_schedule_blocks;
create policy "customers can view active available schedule blocks"
on public.technician_schedule_blocks
for select
to authenticated
using (
  status = 'active'
  and block_type = 'available'
  and exists (
    select 1
    from public.customers c
    where c.auth_user_id = auth.uid()
  )
);

drop function if exists public.create_customer_scheduled_job(uuid, uuid, timestamptz, timestamptz, text, text, text);

create or replace function public.create_customer_scheduled_job(
  p_vehicle_id uuid,
  p_technician_user_id uuid,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz,
  p_service_type text,
  p_service_description text default null,
  p_notes text default null,
  p_service_duration_minutes integer default null,
  p_travel_time_minutes integer default 0,
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
  v_slot_duration interval;
begin
  if v_auth_user_id is null then
    raise exception 'You must be logged in to schedule service.';
  end if;

  if p_scheduled_end <= p_scheduled_start then
    raise exception 'Scheduled end time must be after the start time.';
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

  v_slot_duration := p_scheduled_end - p_scheduled_start;

  if not exists (
    select 1
    from public.technician_schedule_blocks block
    where block.technician_user_id = p_technician_user_id
      and block.status = 'active'
      and block.block_type = 'available'
      and block.starts_at <= p_scheduled_start
      and block.ends_at >= p_scheduled_end
  ) then
    raise exception 'That service time is no longer available.';
  end if;

  if exists (
    select 1
    from public.jobs job
    where job.assigned_tech_user_id = p_technician_user_id
      and job.scheduled_start is not null
      and job.status not in ('cancelled', 'completed')
      and tstzrange(
        job.scheduled_start,
        coalesce(job.scheduled_end, job.scheduled_start + v_slot_duration),
        '[)'
      ) && tstzrange(p_scheduled_start, p_scheduled_end, '[)')
  ) then
    raise exception 'That service time was just booked. Please choose another time.';
  end if;

  if exists (
    select 1
    from public.appointments appointment
    where appointment.assigned_tech_user_id = p_technician_user_id
      and appointment.appointment_status not in ('cancelled', 'completed')
      and tstzrange(
        appointment.scheduled_start,
        coalesce(appointment.scheduled_end, appointment.scheduled_start + v_slot_duration),
        '[)'
      ) && tstzrange(p_scheduled_start, p_scheduled_end, '[)')
  ) then
    raise exception 'That service time was just booked. Please choose another time.';
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
    scheduled_start,
    scheduled_end,
    assigned_tech_user_id,
    created_by_user_id,
    notes,
    service_duration_minutes,
    travel_time_minutes,
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
    coalesce(nullif(trim(p_service_type), ''), 'general_service'),
    nullif(trim(coalesce(p_service_description, '')), ''),
    'customer_portal',
    p_scheduled_start::date,
    p_scheduled_start,
    p_scheduled_end,
    p_technician_user_id,
    v_auth_user_id,
    nullif(trim(coalesce(p_notes, '')), ''),
    greatest(15, least(coalesce(p_service_duration_minutes, extract(epoch from v_slot_duration)::integer / 60), 480)),
    greatest(0, least(coalesce(p_travel_time_minutes, 0), 240)),
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

grant execute on function public.create_customer_scheduled_job(uuid, uuid, timestamptz, timestamptz, text, text, text, integer, integer, text, text, text, text, text) to authenticated;
