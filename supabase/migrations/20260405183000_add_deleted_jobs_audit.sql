create table if not exists public.deleted_jobs_audit (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  business_job_number text,
  customer_id uuid,
  customer_name text,
  vehicle_id uuid,
  vehicle_label text,
  status text,
  priority text,
  service_type text,
  service_description text,
  quote_total numeric(10,2),
  requested_date date,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  deleted_by_user_id uuid references auth.users(id) on delete set null,
  deleted_by_name text,
  deleted_by_email text,
  deleted_at timestamptz not null default now(),
  related_counts jsonb not null default '{}'::jsonb,
  job_snapshot jsonb not null default '{}'::jsonb
);

create index if not exists deleted_jobs_audit_deleted_at_idx
  on public.deleted_jobs_audit (deleted_at desc);

create index if not exists deleted_jobs_audit_job_id_idx
  on public.deleted_jobs_audit (job_id);

alter table public.deleted_jobs_audit enable row level security;

drop policy if exists "admins can view deleted jobs audit" on public.deleted_jobs_audit;
create policy "admins can view deleted jobs audit"
on public.deleted_jobs_audit
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

create or replace function public.log_deleted_job()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  deleter_name text;
  deleter_email text;
  customer_display text;
  vehicle_display text;
  deleted_quote_total numeric(10,2);
begin
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

  select nullif(trim(concat_ws(' ', c.first_name, c.last_name)), '')
  into customer_display
  from public.customers c
  where c.id = old.customer_id;

  select nullif(trim(concat_ws(' ', v.year, v.make, v.model)), '')
  into vehicle_display
  from public.vehicles v
  where v.id = old.vehicle_id;

  select e.total_amount
  into deleted_quote_total
  from public.estimates e
  where e.job_id = old.id
  order by e.updated_at desc nulls last, e.created_at desc nulls last
  limit 1;

  insert into public.deleted_jobs_audit (
    job_id,
    business_job_number,
    customer_id,
    customer_name,
    vehicle_id,
    vehicle_label,
    status,
    priority,
    service_type,
    service_description,
    quote_total,
    requested_date,
    scheduled_start,
    scheduled_end,
    deleted_by_user_id,
    deleted_by_name,
    deleted_by_email,
    related_counts,
    job_snapshot
  )
  values (
    old.id,
    old.business_job_number,
    old.customer_id,
    customer_display,
    old.vehicle_id,
    vehicle_display,
    old.status,
    old.priority,
    old.service_type,
    old.service_description,
    deleted_quote_total,
    old.requested_date,
    old.scheduled_start,
    old.scheduled_end,
    auth.uid(),
    deleter_name,
    deleter_email,
    jsonb_build_object(
      'job_services', (select count(*) from public.job_services where job_id = old.id),
      'job_parts', (select count(*) from public.job_parts where job_id = old.id),
      'job_notes', (select count(*) from public.job_notes where job_id = old.id),
      'time_entries', (select count(*) from public.time_entries where job_id = old.id),
      'job_assignments', (select count(*) from public.job_assignments where job_id = old.id),
      'job_checklists', (select count(*) from public.job_checklists where job_id = old.id),
      'job_status_history', (select count(*) from public.job_status_history where job_id = old.id),
      'estimates', (select count(*) from public.estimates where job_id = old.id)
    ),
    to_jsonb(old)
  );

  return old;
end;
$$;

drop trigger if exists before_job_delete_log on public.jobs;

create trigger before_job_delete_log
before delete on public.jobs
for each row
execute function public.log_deleted_job();

create or replace function public.cleanup_deleted_job_estimates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.estimate_line_items
  where estimate_id in (
    select e.id
    from public.estimates e
    where e.job_id = old.id
  );

  delete from public.estimates
  where job_id = old.id;

  return old;
end;
$$;

drop trigger if exists after_job_delete_cleanup on public.jobs;

create trigger after_job_delete_cleanup
after delete on public.jobs
for each row
execute function public.cleanup_deleted_job_estimates();

drop policy if exists "managers and admins can delete jobs" on public.jobs;
create policy "managers and admins can delete jobs"
on public.jobs
for delete
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('manager', 'admin')
  )
  or (
    status is distinct from 'completed'
    and (
      assigned_tech_user_id = auth.uid()
      or assigned_tech_user_id is null
    )
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'technician'
    )
  )
);
