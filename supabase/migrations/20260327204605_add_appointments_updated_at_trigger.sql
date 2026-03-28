create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_appointments_updated_at on public.appointments;

create trigger set_appointments_updated_at
before update on public.appointments
for each row
execute function public.set_updated_at();