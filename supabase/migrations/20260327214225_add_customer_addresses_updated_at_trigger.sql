create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_customer_addresses_updated_at on public.customer_addresses;

create trigger set_customer_addresses_updated_at
before update on public.customer_addresses
for each row
execute function public.set_updated_at();