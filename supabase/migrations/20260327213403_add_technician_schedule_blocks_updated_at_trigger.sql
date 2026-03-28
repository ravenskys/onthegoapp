create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_technician_schedule_blocks_updated_at on public.technician_schedule_blocks;

create trigger set_technician_schedule_blocks_updated_at
before update on public.technician_schedule_blocks
for each row
execute function public.set_updated_at();