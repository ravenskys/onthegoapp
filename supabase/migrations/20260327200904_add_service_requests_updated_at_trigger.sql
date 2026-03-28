create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_service_requests_updated_at on public.service_requests;

create trigger set_service_requests_updated_at
before update on public.service_requests
for each row
execute function public.set_updated_at();