update public.service_catalog
set
  default_price = case
    when default_duration_minutes is null then null
    else round((default_duration_minutes::numeric / 60.0) * 120.0, 2)
  end,
  default_cost = case
    when default_duration_minutes is null then null
    else round((default_duration_minutes::numeric / 60.0) * 30.0, 2)
  end
where is_active = true;
