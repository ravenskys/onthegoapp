alter table public.customers
  add column if not exists phone_extension text null;

comment on column public.customers.phone_extension is 'Optional phone extension (digits) for the primary customer number.';
