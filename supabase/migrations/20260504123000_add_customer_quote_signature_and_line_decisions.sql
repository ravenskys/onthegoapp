alter table public.estimates
  add column if not exists customer_signature_name text,
  add column if not exists customer_signed_at timestamptz,
  add column if not exists customer_signature_notes text,
  add column if not exists customer_signed_by_auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists customer_authorized_total numeric(10,2);

comment on column public.estimates.customer_signature_name is
  'Customer-entered signature name authorizing approved estimate line items.';
comment on column public.estimates.customer_signed_at is
  'When the customer completed the signed quote response.';
comment on column public.estimates.customer_signature_notes is
  'Optional customer note included with the signed estimate response.';
comment on column public.estimates.customer_signed_by_auth_user_id is
  'Auth user who signed the estimate response.';
comment on column public.estimates.customer_authorized_total is
  'Total amount for approved line items in the signed customer response.';

create table if not exists public.estimate_line_item_customer_decisions (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  estimate_line_item_id uuid not null references public.estimate_line_items(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  decision text not null check (decision in ('approved', 'declined')),
  note text,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (estimate_line_item_id)
);

comment on table public.estimate_line_item_customer_decisions is
  'Customer response for each estimate line item before the quote is signed.';

create or replace function public.set_estimate_line_item_customer_decisions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_estimate_line_item_customer_decisions_updated_at
on public.estimate_line_item_customer_decisions;

create trigger set_estimate_line_item_customer_decisions_updated_at
before update on public.estimate_line_item_customer_decisions
for each row
execute function public.set_estimate_line_item_customer_decisions_updated_at();

alter table public.estimate_line_item_customer_decisions enable row level security;

drop policy if exists "customers can view their own estimate decisions"
on public.estimate_line_item_customer_decisions;
drop policy if exists "customers can insert their own estimate decisions"
on public.estimate_line_item_customer_decisions;
drop policy if exists "customers can update their own estimate decisions"
on public.estimate_line_item_customer_decisions;
drop policy if exists "internal can view estimate decisions"
on public.estimate_line_item_customer_decisions;

create policy "customers can view their own estimate decisions"
on public.estimate_line_item_customer_decisions
for select
to authenticated
using (
  customer_id in (
    select c.id
    from public.customers c
    where c.auth_user_id = auth.uid()
  )
);

create policy "customers can insert their own estimate decisions"
on public.estimate_line_item_customer_decisions
for insert
to authenticated
with check (
  customer_id in (
    select c.id
    from public.customers c
    where c.auth_user_id = auth.uid()
  )
);

create policy "customers can update their own estimate decisions"
on public.estimate_line_item_customer_decisions
for update
to authenticated
using (
  customer_id in (
    select c.id
    from public.customers c
    where c.auth_user_id = auth.uid()
  )
)
with check (
  customer_id in (
    select c.id
    from public.customers c
    where c.auth_user_id = auth.uid()
  )
);

create policy "internal can view estimate decisions"
on public.estimate_line_item_customer_decisions
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('technician', 'manager', 'admin')
  )
);

drop policy if exists "customers can view estimate line items for their own estimates"
on public.estimate_line_items;

create policy "customers can view estimate line items for their own estimates"
on public.estimate_line_items
for select
to authenticated
using (
  exists (
    select 1
    from public.estimates e
    join public.customers c
      on c.id = e.customer_id
    where e.id = estimate_line_items.estimate_id
      and c.auth_user_id = auth.uid()
  )
);
