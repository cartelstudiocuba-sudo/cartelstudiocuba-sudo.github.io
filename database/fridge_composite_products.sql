-- Atomic product+recipe saves; component inventory is never consumed.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
insert into studio_access_private.fridge_pricing_backups(name,definition) select 'composite.'||p.proname,pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace='studio_access_private'::regnamespace and p.proname in ('fridge_command','fridge_pricing_command');
alter table studio_access_private.fridge_products drop constraint fridge_products_category_check;
alter table studio_access_private.fridge_products add constraint fridge_products_category_check check(category in ('Refrescos','Jugos','Agua','Cervezas','Otros','Papitas y snacks','Frutos secos','Dulces y galletas','Café'));
alter table studio_access_private.fridge_products add column product_type text not null default 'resale' check(product_type in ('resale','composite'));
update studio_access_private.fridge_products p set product_type='composite' where exists(select 1 from studio_access_private.fridge_recipes r where r.product_id=p.id);
create function studio_access_private.fridge_composition_validate(p_rows jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare line jsonb;clean jsonb:='[]';qty numeric;unit_cost numeric;total numeric:=0;name text;unit text;
begin
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 100 then raise exception 'Agrega entre 1 y 100 insumos a la composición';end if;
 for line in select value from jsonb_array_elements(p_rows) loop
  name:=btrim(coalesce(line->>'name',''));unit:=btrim(coalesce(line->>'unit',''));qty:=(line->>'quantity')::numeric;unit_cost:=(line->>'unit_cost')::numeric;
  if length(name) not between 1 and 160 or length(unit) not between 1 and 60 then raise exception 'Indica el nombre y la unidad de cada insumo';end if;
  if qty is null or qty<=0 or qty>1000000 or qty::text in ('NaN','Infinity','-Infinity') or qty<>round(qty,6) or unit_cost is null or unit_cost<0 or unit_cost>9999999999.99 or unit_cost::text in ('NaN','Infinity','-Infinity') or unit_cost<>round(unit_cost,6) then raise exception 'Revisa las cantidades y costos; se admiten hasta seis decimales';end if;
  total:=total+qty*unit_cost;
  clean:=clean||jsonb_build_array(jsonb_build_object('name',name,'unit',unit,'quantity',qty,'unit_cost',unit_cost));
 end loop;
 if total>9999999999.99 then raise exception 'El costo compuesto excede el máximo admitido';end if;
 return jsonb_build_object('components',clean,'cost',ceil(total*100)/100,'inventory_consumption_enabled',false);
end $$;
alter function studio_access_private.fridge_command(uuid,text,jsonb) rename to fridge_command_before_composite;
revoke all on function studio_access_private.fridge_command_before_composite(uuid,text,jsonb) from public,anon,authenticated;
create function studio_access_private.fridge_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<composite>>
declare prior studio_access_private.fridge_operations%rowtype;prod studio_access_private.fridge_products%rowtype;checked jsonb;normalized jsonb:=p_payload;r jsonb;kind text;recipe_rev integer;target uuid;line jsonb;items jsonb;
begin
 if not studio_access_private.fridge_allowed() then raise exception 'No tienes acceso a Nevera audiovisual' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 select * into prior from studio_access_private.fridge_operations where id=p_id;
 if found then if prior.actor_id<>auth.uid() or prior.kind<>p_kind or prior.payload<>p_payload then raise exception 'El identificador ya pertenece a otra operación';end if;return prior.result;end if;
 if p_kind='product' then
  select * into prod from studio_access_private.fridge_products where id=(p_payload->>'id')::uuid for update;
  kind:=case when p_payload ? 'product_type' then p_payload->>'product_type' else coalesce(prod.product_type,'resale') end;
  if kind is null or kind not in ('resale','composite') then raise exception 'Selecciona un tipo de producto válido';end if;
  if kind='composite' then
   checked:=studio_access_private.fridge_composition_validate(p_payload->'components');
   select revision into recipe_rev from studio_access_private.fridge_recipes where product_id=prod.id;
   if (p_payload->>'recipe_revision')::integer is distinct from coalesce(recipe_rev,0) then raise exception 'La composición cambió. Actualiza antes de guardar.';end if;
   if (p_payload->>'cost')::numeric is distinct from (checked->>'cost')::numeric then raise exception 'El costo no coincide con la composición calculada';end if;
   normalized:=p_payload||jsonb_build_object('cost',checked->'cost','purchase',jsonb_build_object('currency','USD','amount',checked->'cost','rate',1,'source','composition'));
  end if;
 elsif p_kind='replenish' then
  for line in select value from jsonb_array_elements(p_payload->'items') loop
   select * into prod from studio_access_private.fridge_products where id=(line->>'id')::uuid;
   if prod.product_type='composite' and (line->>'unit_cost')::numeric is distinct from prod.cost then raise exception 'El costo de este producto se modifica desde su composición';end if;
  end loop;
 end if;
 r:=studio_access_private.fridge_command_before_composite(p_id,p_kind,normalized);
 if p_kind='product' then
  target:=(r->>'product_id')::uuid;
  update studio_access_private.fridge_products set product_type=kind where id=target;
  if kind='composite' then
   insert into studio_access_private.fridge_recipes(product_id,components,cost,updated_by) values(target,checked->'components',(checked->>'cost')::numeric,auth.uid()) on conflict(product_id) do update set components=excluded.components,cost=excluded.cost,revision=fridge_recipes.revision+1,updated_by=auth.uid(),updated_at=now();
   select revision into recipe_rev from studio_access_private.fridge_recipes where product_id=target;
  end if;
  checked:=jsonb_build_object('product_type',kind,'components',case when kind='composite' then checked->'components' else null end,'recipe_revision',case when kind='composite' then recipe_rev else null end,'inventory_consumption_enabled',false);
  update studio_access_private.fridge_cost_audit set snapshot=snapshot||checked where operation_id=p_id and product_id=target and fridge_cost_audit.kind='product';
  r:=r||checked;r:=jsonb_set(r,'{pricing}',coalesce(r->'pricing','{}')||checked);
 elsif p_kind='sale' then
  items:='[]';for line in select value from jsonb_array_elements(r->'items') loop
   select * into prod from studio_access_private.fridge_products where id=(line->>'id')::uuid;
   checked:=jsonb_build_object('product_type',prod.product_type,'inventory_consumption_enabled',false);
   if prod.product_type='composite' then select checked||jsonb_build_object('components',components,'recipe_revision',revision) into checked from studio_access_private.fridge_recipes where product_id=prod.id;end if;
   items:=items||jsonb_build_array(line||coalesce(checked,'{}'));
  end loop;
  r:=jsonb_set(r,'{items}',items);update studio_access_private.fridge_sales set items=composite.items where id=p_id;
 end if;
 update studio_access_private.fridge_operations set payload=p_payload,result=r where id=p_id;
 return r;
end $$;
-- Keep the existing Manager-only composition editor compatible with the new product type.
create or replace function studio_access_private.fridge_pricing_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare checked jsonb;r jsonb;existed boolean;
begin
 if not (studio_access_private.fridge_manager() or studio_access_private.fridge_allowed()) then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 if p_kind='config' then raise exception 'Administra los conceptos y porcentajes desde Finanzas → Fichas de costo';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 existed:=exists(select 1 from studio_access_private.fridge_pricing_events where id=p_id);
 if p_kind='recipe' and not existed then checked:=studio_access_private.fridge_composition_validate(p_payload->'components');end if;
 r:=studio_access_private.fridge_pricing_command_before_finance(p_id,p_kind,p_payload);
 if p_kind='recipe' and not existed then update studio_access_private.fridge_products set product_type='composite' where id=(p_payload->>'product_id')::uuid;end if;
 return r;
end $$;
revoke all on function studio_access_private.fridge_composition_validate(jsonb),studio_access_private.fridge_command(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function studio_access_private.fridge_command(uuid,text,jsonb) to authenticated;
