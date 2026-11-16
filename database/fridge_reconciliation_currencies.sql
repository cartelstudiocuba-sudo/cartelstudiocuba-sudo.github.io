-- Verify original cash/transfer currencies while preserving immutable USD bookkeeping.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
create function studio_access_private.fridge_original_receipts(s jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare totals jsonb;begin
 select coalesce(jsonb_agg(to_jsonb(t) order by method,currency),'[]') into totals from (
 select coalesce(p->'collection'->>'currency','USD') currency,p->>'method' method,sum(coalesce((p->'collection'->>'amount')::numeric,(p->>'amount')::numeric)) amount
 from jsonb_array_elements(coalesce(s->'payments','[]')) p group by 1,2
 ) t;
 if jsonb_array_length(totals)=0 then
  if jsonb_array_length(coalesce(s->'collection_totals','[]'))>0 then
   select jsonb_agg(jsonb_build_object('currency',p->>'currency','method',p->>'method','amount',(p->>'amount')::numeric)) into totals from jsonb_array_elements(s->'collection_totals') p;
  else
   select coalesce(jsonb_agg(jsonb_build_object('currency','USD','method',method,'amount',amount)),'[]') into totals from (values ('cash',coalesce((s->>'cash')::numeric,0)),('transfer',coalesce((s->>'transfer')::numeric,0))) t(method,amount) where amount>0;
  end if;
 end if;return totals;
end $$;
revoke all on function studio_access_private.fridge_original_receipts(jsonb) from public,anon,authenticated;
alter function studio_access_private.fridge_reconciliation_command(uuid,text,jsonb) rename to fridge_reconciliation_command_before_original_currency;
revoke all on function studio_access_private.fridge_reconciliation_command_before_original_currency(uuid,text,jsonb) from public,anon,authenticated;
create function studio_access_private.fridge_reconciliation_command(p_id uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r studio_access_private.fridge_reconciliations%rowtype;t jsonb;expected jsonb;input jsonb;item jsonb;method text;field_name text;begin
 if not (studio_access_private.fridge_allowed() or studio_access_private.fridge_manager()) then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 if exists(select 1 from studio_access_private.fridge_reconciliation_events where request_id=p_id) then return studio_access_private.fridge_reconciliation_command_before_original_currency(p_id,p_action,p_payload);end if;
 if p_action='approve' then
  if not studio_access_private.fridge_manager() then raise exception 'Solo el Manager General puede confirmar el recibido' using errcode='42501';end if;
  select * into r from studio_access_private.fridge_reconciliations where id=(p_payload->>'report_id')::uuid for update;
  if not found then raise exception 'Cuadre no encontrado';end if;
  t:=studio_access_private.fridge_original_receipts(r.snapshot);
  foreach method in array array['cash','transfer'] loop
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
 return studio_access_private.fridge_reconciliation_command_before_original_currency(p_id,p_action,p_payload);
end $$;
revoke all on function studio_access_private.fridge_reconciliation_command(uuid,text,jsonb) from public,anon;
grant execute on function studio_access_private.fridge_reconciliation_command(uuid,text,jsonb) to authenticated;
