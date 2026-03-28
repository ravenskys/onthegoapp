create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_job_notes_updated_at on public.job_notes;

create trigger set_job_notes_updated_at
before update on public.job_notes
for each row
execute function public.set_updated_at();