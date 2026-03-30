create or replace function public.assign_business_job_numbers()
returns trigger
language plpgsql
as $$
declare
  next_customer_number integer;
  next_vehicle_number integer;
  next_service_number integer;
begin
  -- Assign customer number if missing
  if new.customer_id is not null then
    update public.customers
    set customer_number = (
      select coalesce(max(c.customer_number), 0) + 1
      from public.customers c
      where c.customer_number is not null
    )
    where id = new.customer_id
      and customer_number is null;

    select customer_number
    into next_customer_number
    from public.customers
    where id = new.customer_id;
  end if;

  -- Assign vehicle number if missing, scoped to customer
  if new.vehicle_id is not null and new.customer_id is not null then
    update public.vehicles v
    set vehicle_number = sub.next_vehicle_number
    from (
      select coalesce(max(vehicle_number), 0) + 1 as next_vehicle_number
      from public.vehicles
      where customer_id = new.customer_id
        and vehicle_number is not null
    ) sub
    where v.id = new.vehicle_id
      and v.vehicle_number is null;

    select vehicle_number
    into next_vehicle_number
    from public.vehicles
    where id = new.vehicle_id;
  end if;

  -- Assign next service number for this customer + vehicle pair
  if new.service_number is null and new.customer_id is not null and new.vehicle_id is not null then
    select coalesce(max(j.service_number), 0) + 1
    into next_service_number
    from public.jobs j
    where j.customer_id = new.customer_id
      and j.vehicle_id = new.vehicle_id
      and j.service_number is not null;

    new.service_number := next_service_number;
  end if;

  -- Build 4/2/4 business number
  if next_customer_number is not null
     and next_vehicle_number is not null
     and new.service_number is not null then
    new.business_job_number :=
      lpad(next_customer_number::text, 4, '0') ||
      lpad(next_vehicle_number::text, 2, '0') ||
      lpad(new.service_number::text, 4, '0');
  end if;

  return new;
end;
$$;

drop trigger if exists set_business_job_numbers on public.jobs;

create trigger set_business_job_numbers
before insert on public.jobs
for each row
execute function public.assign_business_job_numbers();