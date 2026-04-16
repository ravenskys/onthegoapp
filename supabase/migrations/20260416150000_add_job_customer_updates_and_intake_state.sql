alter table public.jobs
  add column if not exists intake_state text,
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by_user_id uuid references auth.users(id) on delete set null;

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
      'ready_pickup',
      'completed'
    )
  );

create table if not exists public.job_customer_updates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  update_type text not null default 'general',
  status_snapshot text,
  title text not null,
  message text not null,
  visibility text not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_customer_updates
  drop constraint if exists job_customer_updates_visibility_check;
alter table public.job_customer_updates
  add constraint job_customer_updates_visibility_check
  check (visibility in ('internal', 'customer'));

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
      'general'
    )
  );

drop trigger if exists set_job_customer_updates_updated_at on public.job_customer_updates;
create trigger set_job_customer_updates_updated_at
before update on public.job_customer_updates
for each row
execute function public.handle_updated_at();

create index if not exists job_customer_updates_job_id_created_at_idx
  on public.job_customer_updates (job_id, created_at desc);
create index if not exists job_customer_updates_visibility_idx
  on public.job_customer_updates (visibility);

alter table public.job_customer_updates enable row level security;

drop policy if exists "job updates select internal roles" on public.job_customer_updates;
create policy "job updates select internal roles"
on public.job_customer_updates
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

drop policy if exists "job updates select customer visible own jobs" on public.job_customer_updates;
create policy "job updates select customer visible own jobs"
on public.job_customer_updates
for select
to authenticated
using (
  visibility = 'customer'
  and exists (
    select 1
    from public.jobs j
    join public.customers c on c.id = j.customer_id
    where j.id = job_customer_updates.job_id
      and c.auth_user_id = auth.uid()
  )
);

drop policy if exists "job updates insert internal roles" on public.job_customer_updates;
create policy "job updates insert internal roles"
on public.job_customer_updates
for insert
to authenticated
with check (
  (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin', 'manager')
    )
  )
  or (
    exists (
      select 1
      from public.jobs j
      where j.id = job_customer_updates.job_id
        and j.assigned_tech_user_id = auth.uid()
    )
  )
);

drop policy if exists "job updates update internal roles" on public.job_customer_updates;
create policy "job updates update internal roles"
on public.job_customer_updates
for update
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager')
  )
  or created_by_user_id = auth.uid()
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'manager')
  )
  or created_by_user_id = auth.uid()
);

grant select, insert, update on public.job_customer_updates to authenticated;

create or replace function public.claim_job_for_current_tech(
  p_job_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_is_internal boolean;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.'
      using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('technician', 'manager', 'admin')
  )
  into v_is_internal;

  if not v_is_internal then
    raise exception 'Only internal users can claim jobs.'
      using errcode = '42501';
  end if;

  update public.jobs j
  set
    assigned_tech_user_id = auth.uid(),
    claimed_by_user_id = auth.uid(),
    claimed_at = now(),
    intake_state = coalesce(j.intake_state, 'claimed'),
    status = case when j.status in ('new', 'new_request', 'draft') then 'in_progress' else j.status end,
    updated_at = now()
  where j.id = p_job_id
    and (
      j.assigned_tech_user_id is null
      or j.assigned_tech_user_id = auth.uid()
    );

  if not found then
    raise exception 'Job could not be claimed. It may already be assigned.'
      using errcode = 'P0002';
  end if;
end;
$$;

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

  if p_intake_state not in ('queued', 'claimed', 'on_site', 'in_service', 'waiting_parts', 'ready_pickup', 'completed') then
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

grant execute on function public.claim_job_for_current_tech(uuid) to authenticated;
grant execute on function public.update_job_intake_state(uuid, text, text) to authenticated;
