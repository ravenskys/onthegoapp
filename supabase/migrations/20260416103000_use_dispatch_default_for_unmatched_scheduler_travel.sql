drop function if exists public.get_customer_available_schedule_slots(timestamptz, timestamptz, integer, text, text, text, integer);

create or replace function public.get_customer_available_schedule_slots(
  p_range_start timestamptz,
  p_range_end timestamptz,
  p_service_duration_minutes integer default 60,
  p_service_city text default null,
  p_service_state text default null,
  p_service_zip text default null,
  p_default_travel_time_minutes integer default 30
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
      nullif(regexp_replace(coalesce(p_service_zip, ''), '[^0-9]', '', 'g'), '') as service_zip,
      greatest(5, least(coalesce(p_default_travel_time_minutes, 30), 180)) as default_travel_minutes
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
      config.service_zip,
      config.default_travel_minutes
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
          when prior_job.id is null then slot.default_travel_minutes
          when slot.service_zip is null and slot.service_city is null and slot.service_state is null then slot.default_travel_minutes
          when nullif(regexp_replace(coalesce(prior_job.service_zip, ''), '[^0-9]', '', 'g'), '') is null
            and nullif(lower(trim(coalesce(prior_job.service_city, ''))), '') is null
            and nullif(lower(trim(coalesce(prior_job.service_state, ''))), '') is null
            then slot.default_travel_minutes
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
          else slot.default_travel_minutes
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

grant execute on function public.get_customer_available_schedule_slots(timestamptz, timestamptz, integer, text, text, text, integer) to authenticated;
