alter table public.invoice_line_items enable row level security;

create policy "customers can view their own invoice line items"
on public.invoice_line_items
for select
to authenticated
using (
  exists (
    select 1
    from public.invoices i
    join public.customers c on c.id = i.customer_id
    where i.id = invoice_line_items.invoice_id
      and c.auth_user_id = auth.uid()
  )
);

create policy "technicians can view job-related invoice line items"
on public.invoice_line_items
for select
to authenticated
using (
  exists (
    select 1
    from public.invoices i
    join public.jobs j on j.id = i.job_id
    where i.id = invoice_line_items.invoice_id
      and (
        j.assigned_tech_user_id = auth.uid()
        or exists (
          select 1
          from public.job_assignments ja
          where ja.job_id = j.id
            and ja.technician_user_id = auth.uid()
        )
      )
  )
);

create policy "managers and admins can view all invoice line items"
on public.invoice_line_items
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('manager', 'admin')
  )
);

create policy "managers and admins can insert invoice line items"
on public.invoice_line_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('manager', 'admin')
  )
);

create policy "managers and admins can update invoice line items"
on public.invoice_line_items
for update
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('manager', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('manager', 'admin')
  )
);