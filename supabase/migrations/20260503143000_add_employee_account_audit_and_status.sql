alter table public.profiles
add column if not exists employment_status text not null default 'active';

alter table public.profiles
drop constraint if exists profiles_employment_status_check;

alter table public.profiles
add constraint profiles_employment_status_check
check (
  employment_status = any (
    array[
      'active'::text,
      'inactive'::text,
      'on_leave'::text,
      'terminated'::text
    ]
  )
);

create table if not exists public.employee_account_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_email text null,
  actor_roles text[] not null default '{}'::text[],
  target_user_id uuid not null references auth.users(id) on delete cascade,
  target_email text null,
  action_type text not null,
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists employee_account_audit_created_at_idx
on public.employee_account_audit (created_at desc);

create index if not exists employee_account_audit_target_user_id_idx
on public.employee_account_audit (target_user_id);

alter table public.employee_account_audit enable row level security;
alter table public.employee_account_audit force row level security;

drop policy if exists "employee_account_audit_admin_select" on public.employee_account_audit;
create policy "employee_account_audit_admin_select"
on public.employee_account_audit
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
