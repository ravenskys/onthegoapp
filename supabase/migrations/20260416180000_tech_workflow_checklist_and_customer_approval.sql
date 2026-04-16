-- Technician workflow: service checklist timing, line-item completion, intake state for customer approval,
-- and customer-visible update type for approval requests.

alter table public.jobs
  add column if not exists service_checklist_started_at timestamptz,
  add column if not exists service_checklist_completed_at timestamptz;

comment on column public.jobs.service_checklist_started_at is
  'When the technician began the in-app service checklist (Start Service).';
comment on column public.jobs.service_checklist_completed_at is
  'When the technician finished the planned-service checklist section.';

alter table public.job_services
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by_user_id uuid references auth.users(id) on delete set null;

comment on column public.job_services.completed_at is 'Technician marked this planned line as done.';
comment on column public.job_services.completed_by_user_id is 'User who marked the line complete.';

-- Intake: allow waiting on customer approval for added work
alter table public.jobs
  drop constraint if exists jobs_intake_state_check;

alter table public.jobs
  add constraint jobs_intake_state_check
  check (
    intake_state is null
    or intake_state in (
      'queued',
      'claimed',
      'on_site',
      'in_service',
      'waiting_parts',
      'awaiting_customer_approval',
      'ready_pickup',
      'completed'
    )
  );

create or replace function public.update_job_intake_state(
  p_job_id uuid,
  p_intake_state text,
  p_status text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_can_update boolean;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.'
      using errcode = '42501';
  end if;

  if p_intake_state not in (
    'queued',
    'claimed',
    'on_site',
    'in_service',
    'waiting_parts',
    'awaiting_customer_approval',
    'ready_pickup',
    'completed'
  ) then
    raise exception 'Invalid intake state.'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.jobs j
    where j.id = p_job_id
      and (
        j.assigned_tech_user_id = auth.uid()
        or exists (
          select 1
          from public.user_roles ur
          where ur.user_id = auth.uid()
            and ur.role in ('manager', 'admin')
        )
      )
  )
  into v_can_update;

  if not v_can_update then
    raise exception 'You are not allowed to update this job intake state.'
      using errcode = '42501';
  end if;

  update public.jobs j
  set
    intake_state = p_intake_state,
    status = coalesce(p_status, j.status),
    updated_at = now()
  where j.id = p_job_id;
end;
$$;

-- Customer updates: type for additional-work approval requests (still use visibility = customer for portal)
alter table public.job_customer_updates
  drop constraint if exists job_customer_updates_update_type_check;

alter table public.job_customer_updates
  add constraint job_customer_updates_update_type_check
  check (
    update_type in (
      'arrival',
      'diagnosis',
      'parts_delay',
      'service_complete',
      'status',
      'general',
      'customer_approval'
    )
  );
