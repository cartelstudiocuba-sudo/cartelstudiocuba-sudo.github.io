alter table public.inventory_order_items add column prepared_quantity numeric not null default 0 check(prepared_quantity>=0 and prepared_quantity<=approved_quantity-delivered_quantity);
create function studio_access_private.inventory_order_prepare(order_id uuid,quantities jsonb) returns void language plpgsql security definer set search_path='' as $$
declare o public.inventory_orders;i public.inventory_order_items;q numeric;
begin
 if auth.uid() is null or not public.inventory_has_access('write') then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 perform pg_advisory_xact_lock(761820261018::bigint);select * into strict o from public.inventory_orders where id=$1 for update;
 if o.status not in ('approved','preparing','partial') or jsonb_typeof(quantities)<>'object' then raise exception 'Pedido no disponible para preparar';end if;
 for i in select * from public.inventory_order_items where inventory_order_items.order_id=o.id order by product_id for update loop
  q=coalesce((quantities->>i.id::text)::numeric,0);
  if q<0 or q>i.approved_quantity-i.delivered_quantity then raise exception 'Cantidad de preparación no válida';end if;
  update public.inventory_order_items set prepared_quantity=q where id=i.id;
 end loop;
 if o.status='approved' then update public.inventory_orders set status='preparing' where id=o.id;end if;
 insert into public.inventory_order_events(order_id,actor_id,actor_name,event,details) values(o.id,auth.uid(),studio_access_private.inventory_actor_name(),'prepared',quantities);
end $$;
revoke all on function studio_access_private.inventory_order_prepare(uuid,jsonb) from public,anon;
grant execute on function studio_access_private.inventory_order_prepare(uuid,jsonb) to authenticated;
create function public.inventory_order_prepare(order_id uuid,quantities jsonb) returns void language sql security invoker set search_path='' as $$select studio_access_private.inventory_order_prepare(order_id,quantities)$$;
revoke all on function public.inventory_order_prepare(uuid,jsonb) from public,anon;
grant execute on function public.inventory_order_prepare(uuid,jsonb) to authenticated;
do $code$declare def text;begin
 select pg_get_functiondef('studio_access_private.inventory_order_deliver(uuid,uuid,jsonb)'::regprocedure) into def;
 def=replace(def,'q>i.approved_quantity-i.delivered_quantity or q>p.stock','q>i.approved_quantity-i.delivered_quantity or q>i.prepared_quantity or q>p.stock');
 def=replace(def,'set delivered_quantity=delivered_quantity+q where','set delivered_quantity=delivered_quantity+q,prepared_quantity=prepared_quantity-q where');
 execute def;
end $code$;
create function studio_access_private.inventory_order_photo_read(path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.inventory_products p where p.photo_path=$1 and p.deleted_at is null and ((studio_access_private.inventory_order_capabilities()->>'approve')::boolean or (studio_access_private.inventory_order_capabilities()->>'fulfil')::boolean or ((studio_access_private.inventory_order_capabilities()->>'create')::boolean and p.department in (studio_access_private.inventory_order_capabilities()->>'area','Generales'))));
$$;
revoke all on function studio_access_private.inventory_order_photo_read(text) from public,anon;
grant execute on function studio_access_private.inventory_order_photo_read(text) to authenticated;
create policy inventory_order_photos on storage.objects for select to authenticated using(bucket_id='inventory-images' and studio_access_private.inventory_order_photo_read(name));

