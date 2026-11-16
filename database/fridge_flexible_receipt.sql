-- Preserve historical sales and record the actual received currency mix.
alter table studio_access_private.fridge_reconciliations add column if not exists receipt_settlement jsonb;
create or replace function studio_access_private.fridge_reconciliation_command(p_id uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r studio_access_private.fridge_reconciliations%rowtype;t jsonb;expected jsonb;input jsonb;item jsonb;method text;field_name text; rate numeric; expected_cup numeric; actual_cup numeric; result jsonb; settlement jsonb;begin
 if not (studio_access_private.fridge_allowed() or studio_access_private.fridge_manager()) then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 if exists(select 1 from studio_access_private.fridge_reconciliation_events where request_id=p_id) then return studio_access_private.fridge_reconciliation_command_before_original_currency(p_id,p_action,p_payload);end if;
 if p_action='approve' then
  if not studio_access_private.fridge_manager() then raise exception 'Solo el Manager General puede confirmar el recibido' using errcode='42501';end if;
  select * into r from studio_access_private.fridge_reconciliations where id=(p_payload->>'report_id')::uuid for update;
  if not found then raise exception 'Cuadre no encontrado';end if;
  t:=studio_access_private.fridge_original_receipts(r.snapshot);
  if p_payload->>'cash_settlement_mode'='equivalent' then
   if coalesce((p_payload->>'inventory_confirmed')::boolean,false) is not true then raise exception 'Confirma el recibido y el conteo de insumos';end if;
   rate:=(p_payload->>'settlement_rate')::numeric;
   if rate is null or rate::text in ('NaN','Infinity','-Infinity') or rate<=0 or rate>1000000 then raise exception 'Tasa del cuadre inválida';end if;
   input:=p_payload->'received_by_currency';
   if jsonb_typeof(input) is distinct from 'array' or jsonb_array_length(input)>2 or jsonb_array_length(input)<1 then raise exception 'Declara el recibido en CUP y USD';end if;
   if (select count(*)<>count(distinct v->>'currency') from jsonb_array_elements(input) v) then raise exception 'Hay monedas duplicadas';end if;
   for item in select value from jsonb_array_elements(input) loop
    if item->>'currency' not in ('USD','CUP') or item->>'currency' is null or jsonb_typeof(item->'amount') is distinct from 'number' or (item->>'amount')::numeric<0 or (item->>'amount')::numeric>9999999999.99 or round((item->>'amount')::numeric,2)<>(item->>'amount')::numeric then raise exception 'Importe o moneda inválidos';end if;
   end loop;
   select coalesce(sum((v->>'amount')::numeric*case when v->>'currency'='USD' then rate else 1 end),0) into expected_cup from jsonb_array_elements(t) v where v->>'method'='cash';
   select coalesce(sum((v->>'amount')::numeric*case when v->>'currency'='USD' then rate else 1 end),0) into actual_cup from jsonb_array_elements(input) v;
   if round(actual_cup,2)<>round(expected_cup,2) then raise exception 'El total recibido no coincide con el esperado según la tasa del cuadre';end if;
   settlement:=jsonb_build_object('rate',rate,'received_by_currency',input,'expected_cup',round(expected_cup,2),'received_cup',round(actual_cup,2),'inventory_confirmed',true);
   p_payload:=p_payload||jsonb_build_object('received_cash',coalesce((r.snapshot->>'cash')::numeric,0));
  end if;
  foreach method in array array['cash','transfer'] loop
   if method='cash' and settlement is not null then continue;end if;
   field_name:=case when method='cash' then 'received_by_currency' else 'verified_transfers' end;input:=p_payload->field_name;
   if jsonb_typeof(input) is distinct from 'array' then raise exception 'Verifica los importes originales por moneda';end if;
   select coalesce(jsonb_agg(jsonb_build_object('currency',v->>'currency','amount',(v->>'amount')::numeric) order by v->>'currency'),'[]') into expected from jsonb_array_elements(t) v where v->>'method'=method;
   if jsonb_array_length(input)<>jsonb_array_length(expected) then raise exception 'Faltan monedas o hay monedas adicionales en el recibido';end if;
   if (select count(*)<>count(distinct v->>'currency') from jsonb_array_elements(input) v) then raise exception 'Hay monedas duplicadas';end if;
   for item in select value from jsonb_array_elements(input) loop
    if jsonb_typeof(item->'amount') is distinct from 'number' or not exists(select 1 from jsonb_array_elements(expected) e where e->>'currency'=item->>'currency' and (e->>'amount')::numeric=(item->>'amount')::numeric) then raise exception 'El importe recibido no coincide con su moneda original';end if;
    if method='transfer' and coalesce((item->>'verified')::boolean,false) is not true then raise exception 'Verifica cada transferencia en su moneda original';end if;
   end loop;
  end loop;
 end if;
 result:=studio_access_private.fridge_reconciliation_command_before_original_currency(p_id,p_action,p_payload);
 if settlement is not null then update studio_access_private.fridge_reconciliations set receipt_settlement=settlement where id=r.id;end if;
 return result;
end $$;
revoke all on function studio_access_private.fridge_reconciliation_command(uuid,text,jsonb) from public,anon;
grant execute on function studio_access_private.fridge_reconciliation_command(uuid,text,jsonb) to authenticated;
