-- =============================================================================
-- Purge ALL application data + Auth user for one email address
-- =============================================================================
-- Run in: Supabase Dashboard → SQL Editor (postgres role).
--
-- 1. Change ONLY the email inside the first INSERT into _purge_email (one line).
-- 2. Run the entire script.
--
-- After: same email can be used for a fresh customer signup / auth user.
-- Optional: delete orphaned files in Supabase Storage if your app stored paths.
-- =============================================================================

begin;

create temporary table _purge_email (norm text primary key);
insert into _purge_email (norm) values (lower(btrim('msherman6903@gmail.com')));

create temporary table purge_customer_ids (id uuid primary key) on commit drop;

insert into purge_customer_ids (id)
select c.id
from public.customers c
cross join _purge_email e
where lower(btrim(c.email)) = e.norm
union
select c.id
from public.customers c
inner join auth.users u on u.id = c.auth_user_id
cross join _purge_email e
where lower(u.email) = e.norm;

delete from public.inspections i
where i.customer_id in (select id from purge_customer_ids)
   or i.vehicle_id in (
     select v.id
     from public.vehicles v
     where v.customer_id in (select id from purge_customer_ids)
   );

delete from public.jobs j
where j.customer_id in (select id from purge_customer_ids);

delete from public.service_requests sr
where sr.customer_id in (select id from purge_customer_ids)
   or lower(btrim(coalesce(sr.contact_email, ''))) = (select norm from _purge_email);

delete from public.estimates e
where e.customer_id in (select id from purge_customer_ids);

delete from public.invoices inv
where inv.customer_id in (select id from purge_customer_ids);

delete from public.appointments a
where a.customer_id in (select id from purge_customer_ids);

delete from public.deleted_customers_audit d
where lower(btrim(coalesce(d.customer_email, ''))) = (select norm from _purge_email);

delete from public.customers c
where c.id in (select id from purge_customer_ids);

delete from auth.identities
where user_id in (
  select id from auth.users u cross join _purge_email e where lower(u.email) = e.norm
);

delete from auth.users u
using _purge_email e
where lower(u.email) = e.norm;

commit;
