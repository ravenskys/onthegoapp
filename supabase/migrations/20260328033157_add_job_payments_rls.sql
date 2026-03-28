alter table public.job_payments enable row level security;

create policy "customers can view their own job payments"
on public.job_payments
for select
to authenticated
using (
  exists (
    select 1
    from public.jobs j
    join public.customers c on c.id = j.customer_id
    where j.id = job_payments.job_id
      and c.auth_user_id = auth.uid()
  )
);

create policy "managers and admins can view all job payments"
on public.job_payments
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

create policy "managers and admins can insert all job payments"
on public.job_payments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('manager', 'admin')
  )
);

create policy "managers and admins can update all job payments"
on public.job_payments
for update
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('manager', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('manager', 'admin')
  )
);