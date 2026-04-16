alter table public.customers
  add column if not exists account_closure_requested_at timestamptz,
  add column if not exists account_closure_request_status text,
  add column if not exists account_closure_request_note text;

alter table public.customers
  drop constraint if exists customers_account_closure_request_status_check;

alter table public.customers
  add constraint customers_account_closure_request_status_check
  check (
    account_closure_request_status is null
    or account_closure_request_status in ('requested', 'reviewing', 'approved', 'rejected', 'completed')
  );

comment on column public.customers.account_closure_requested_at is
  'When the customer requested account closure from the portal.';
comment on column public.customers.account_closure_request_status is
  'Manager/admin workflow state for customer-requested account closure.';
comment on column public.customers.account_closure_request_note is
  'Optional customer note captured when requesting account closure.';

create or replace function public.request_customer_account_closure(
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_customer_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.'
      using errcode = '42501';
  end if;

  select c.id
  into v_customer_id
  from public.customers c
  where c.auth_user_id = auth.uid()
  limit 1;

  if v_customer_id is null then
    raise exception 'Customer account not found for signed-in user.'
      using errcode = 'P0002';
  end if;

  update public.customers
  set
    account_closure_requested_at = now(),
    account_closure_request_status = 'requested',
    account_closure_request_note = nullif(trim(p_note), '')
  where id = v_customer_id;

  -- Disable only customer portal access until staff review.
  delete from public.user_roles
  where user_id = auth.uid()
    and role = 'customer';
end;
$$;

grant execute on function public.request_customer_account_closure(text) to authenticated;
