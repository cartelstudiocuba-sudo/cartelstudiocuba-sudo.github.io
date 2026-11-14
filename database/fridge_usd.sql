-- Adopt USD before the first operation; never relabel existing CUP amounts.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
do $$begin
 if exists(select 1 from studio_access_private.fridge_operations) or exists(select 1 from studio_access_private.fridge_products) then
  raise exception 'La nevera ya tiene registros: se requiere una conversión explícita antes de pasar a USD';
 end if;
end $$;
do $$declare d text;begin
 d:=pg_get_functiondef('studio_access_private.fridge_state()'::regprocedure);
 d:=replace(d,'''currency'', ''CUP''','''currency'', ''USD''');
 d:=replace(d,'''currency'',''CUP''','''currency'',''USD''');execute d;
end $$;
do $$declare d text;begin
 if to_regprocedure('studio_access_private.fridge_command_ledger(uuid,text,jsonb)') is null then
  alter function studio_access_private.fridge_command(uuid,text,jsonb) rename to fridge_command_ledger;
 else
  d:=pg_get_functiondef('studio_access_private.fridge_command(uuid,text,jsonb)'::regprocedure);
  d:=replace(d,'FUNCTION studio_access_private.fridge_command(','FUNCTION studio_access_private.fridge_command_ledger(');execute d;
 end if;
end $$;
revoke all on function studio_access_private.fridge_command_ledger(uuid,text,jsonb) from public,anon,authenticated;
create or replace function studio_access_private.fridge_purchase_check(p jsonb,cost numeric) returns void language plpgsql set search_path='' as $$
declare amount numeric;rate numeric;
begin
 if p is null or jsonb_typeof(p)<>'object' or p->>'currency' is null or p->>'currency' not in ('USD','CUP') then raise exception 'Indica la moneda de compra';end if;
 amount:=(p->>'amount')::numeric;rate:=(p->>'rate')::numeric;
 if amount is null or amount<0 or amount::text in ('NaN','Infinity','-Infinity') or rate is null or rate<=0 or rate::text in ('NaN','Infinity','-Infinity') or (p->>'currency'='USD' and rate<>1) or cost is null or cost<>round(amount/rate,2) then raise exception 'Revisa el costo en USD y la tasa de compra';end if;
end $$;
revoke all on function studio_access_private.fridge_purchase_check(jsonb,numeric) from public,anon,authenticated;
create or replace function studio_access_private.fridge_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare i jsonb;r jsonb;
begin
 if not studio_access_private.fridge_allowed() then raise exception 'No tienes acceso a los productos de nevera' using errcode='42501';end if;
 if p_payload->>'currency' is distinct from 'USD' then raise exception 'Actualiza Nevera audiovisual para trabajar en USD';end if;
 if p_kind='product' then perform studio_access_private.fridge_purchase_check(p_payload->'purchase',(p_payload->>'cost')::numeric);end if;
 if p_kind='replenish' then
  for i in select value from jsonb_array_elements(p_payload->'items') loop
   perform studio_access_private.fridge_purchase_check(i->'purchase',(i->>'unit_cost')::numeric);
  end loop;
 end if;
 r:=studio_access_private.fridge_command_ledger(p_id,p_kind,p_payload);
 if p_kind='replenish' then
  for i in select value from jsonb_array_elements(p_payload->'items') loop
   update studio_access_private.fridge_movements set details=details||jsonb_build_object('currency','USD','purchase',i->'purchase') where operation_id=p_id and product_id=(i->>'id')::uuid;
  end loop;
 end if;
 return r;
end $$;
revoke all on function studio_access_private.fridge_command(uuid,text,jsonb) from public,anon;
grant execute on function studio_access_private.fridge_command(uuid,text,jsonb) to authenticated;
