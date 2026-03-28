create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,

  transaction_type text not null,
  quantity_change numeric(10,2) not null,

  related_job_id uuid references public.jobs(id) on delete set null,
  related_job_part_id uuid references public.job_parts(id) on delete set null,

  reference_number text,
  notes text,

  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);