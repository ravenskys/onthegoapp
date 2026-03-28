create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_time_entries_updated_at on public.time_entries;

create trigger set_time_entries_updated_at
before update on public.time_entries
for each row
execute function public.set_updated_at();