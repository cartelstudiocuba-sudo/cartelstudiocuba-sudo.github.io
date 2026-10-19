alter table public.inventory_products add column updated_at timestamptz not null default now();
update public.inventory_products p
set updated_at = greatest(p.created_at, coalesce((select max(m.created_at) from public.inventory_movements m where m.product_id=p.id),p.created_at));
create function public.inventory_touch_product_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
 new.updated_at = clock_timestamp();
 return new;
end;
$$;
revoke all on function public.inventory_touch_product_updated_at() from public, anon, authenticated;
create trigger inventory_product_updated_at before update on public.inventory_products
for each row execute function public.inventory_touch_product_updated_at();