-- Inventory operates independently until the future Finance module is activated.
-- Preserve inventory authorization, CUP-only validation, dates, atomic stock and request IDs.
do $preflight$
begin
 if exists(select 1 from public.inventory_fund_ledger) then
  raise exception 'The fund already contains ledger entries; review before deferring Finance';
 end if;
end
$preflight$;

create or replace function public.inventory_cup_guard()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare c text;
begin
 perform pg_advisory_xact_lock(761820261018::bigint);
 select currency into strict c from public.inventory_products where id=new.product_id;
 if c<>'CUP' or (new.currency is not null and new.currency<>'CUP') then
  raise exception 'Por ahora solo se permiten operaciones en CUP';
 end if;
 perform studio_access_private.inventory_check_date(new.occurred_on);
 -- No opening balance or available-cash checks in the inventory-only phase.
 return new;
end
$function$;

-- Keep the existing implementation for a reviewed future Finance integration,
-- but never post inventory purchases to the standalone fund while it is deferred.
alter table public.inventory_movements disable trigger z_inventory_purchase_ledger;
