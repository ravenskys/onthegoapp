create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_inventory_items_updated_at on public.inventory_items;

create trigger set_inventory_items_updated_at
before update on public.inventory_items
for each row
execute function public.set_updated_at();