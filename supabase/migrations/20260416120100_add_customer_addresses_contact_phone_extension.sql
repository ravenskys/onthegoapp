alter table public.customer_addresses
  add column if not exists contact_phone_extension text null;

comment on column public.customer_addresses.contact_phone_extension is 'Optional extension for contact_phone at this service location.';
