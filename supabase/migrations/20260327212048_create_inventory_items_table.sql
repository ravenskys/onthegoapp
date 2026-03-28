create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),

  sku text,
  part_number text,
  item_name text not null,
  item_description text,

  category text,
  supplier text,
  supplier_part_number text,

  unit_cost numeric(10,2),
  unit_price numeric(10,2),
  quantity_on_hand numeric(10,2) not null default 0,
  reorder_level numeric(10,2),

  is_active boolean not null default true,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);