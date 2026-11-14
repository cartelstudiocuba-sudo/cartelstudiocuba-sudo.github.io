-- Product details and declared stock are saved atomically, with version and replay checks.
create or replace function studio_access_private.fridge_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare i jsonb;r jsonb;existed boolean;quantity integer;previous integer;target uuid;
begin
 if not studio_access_private.fridge_allowed() then raise exception 'No tienes acceso a los productos de nevera' using errcode='42501';end if;
 if p_payload->>'currency' is distinct from 'USD' then raise exception 'Actualiza Nevera audiovisual para trabajar en USD';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 existed:=exists(select 1 from studio_access_private.fridge_operations where id=p_id);
 if p_kind='product' and p_payload ? 'stock_quantity' then
  if jsonb_typeof(p_payload->'stock_quantity') is distinct from 'number' or (p_payload->>'stock_quantity')::numeric<0 or (p_payload->>'stock_quantity')::numeric>1000000 or (p_payload->>'stock_quantity')::numeric<>trunc((p_payload->>'stock_quantity')::numeric) then raise exception 'La cantidad debe ser un número entero entre 0 y 1000000';end if;
  quantity:=(p_payload->>'stock_quantity')::integer;
  select stock into previous from studio_access_private.fridge_products where id=(p_payload->>'id')::uuid;
  previous:=coalesce(previous,0);
 end if;
 if p_kind='product' then perform studio_access_private.fridge_purchase_check(p_payload->'purchase',(p_payload->>'cost')::numeric);end if;
 if p_kind='replenish' then
  for i in select value from jsonb_array_elements(p_payload->'items') loop
   perform studio_access_private.fridge_purchase_check(i->'purchase',(i->>'unit_cost')::numeric);
  end loop;
 end if;
 r:=studio_access_private.fridge_command_ledger(p_id,p_kind,p_payload);
 if p_kind='product' and quantity is not null and not existed then
  target:=(r->>'product_id')::uuid;
  if quantity<>previous then
   update studio_access_private.fridge_products set stock=quantity,version=version+1,updated_at=now() where id=target;
   insert into studio_access_private.fridge_movements(operation_id,product_id,kind,quantity,stock_after,details)
   values(p_id,target,case when p_payload->>'id' is null then 'replenish' else 'count' end,quantity-previous,quantity,
    jsonb_build_object('expected',previous,'counted',quantity,'purchase_unit_cost',(p_payload->>'cost')::numeric,'currency','USD','purchase',p_payload->'purchase','note',case when p_payload->>'id' is null then 'Existencias iniciales al crear el producto' else 'Cantidad declarada al editar el producto' end));
  end if;
  r:=r||jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',target,'name',p_payload->>'name','before',previous,'quantity',quantity-previous,'after',quantity)));
  update studio_access_private.fridge_operations set result=r where id=p_id;
 end if;
 if p_kind='replenish' then
  for i in select value from jsonb_array_elements(p_payload->'items') loop
   update studio_access_private.fridge_movements set details=details||jsonb_build_object('currency','USD','purchase',i->'purchase') where operation_id=p_id and product_id=(i->>'id')::uuid;
  end loop;
 end if;
 return r;
end $$;
revoke all on function studio_access_private.fridge_command(uuid,text,jsonb) from public,anon;
grant execute on function studio_access_private.fridge_command(uuid,text,jsonb) to authenticated;
