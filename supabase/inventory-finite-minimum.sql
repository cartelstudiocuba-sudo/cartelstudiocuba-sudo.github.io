alter table public.inventory_products add constraint inventory_minimum_finite check (minimum_stock < 'Infinity'::numeric);
