-- New reconciliations use sale-time cost sheets; existing reports remain frozen.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
insert into studio_access_private.fridge_pricing_backups(name,definition) select 'settlement.'||p.proname,pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace='studio_access_private'::regnamespace and p.proname in ('fridge_reconciliation_snapshot','fridge_reconciliation_detail','fridge_reconciliation_command','fridge_reconciliation_state');
create function studio_access_private.fridge_cost_settlement(p_snapshot jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ids uuid[];sale studio_access_private.fridge_sales%rowtype;item jsonb;part jsonb;fee jsonb;ord bigint;source_cost numeric;item_cost numeric;raw_cost numeric;paid numeric;attributed numeric;paid_before numeric;paid_total numeric;covered_total numeric;pending_cost numeric;scale numeric;reserve numeric:=(p_snapshot->>'reserve_cost')::numeric;receipts numeric:=(p_snapshot->>'receipts')::numeric;before_part numeric;after_part numeric;due numeric;base numeric;full_components numeric;cost_ratio numeric;pending_ratio numeric;fund_rows jsonb:='[]';component_rows jsonb:='[]';fee_rows jsonb:='[]';products jsonb;components jsonb;distribution jsonb;complete boolean:=true;composition_complete boolean:=true;fee_total numeric;surplus numeric;shortfall numeric;fund_total numeric;pending_total numeric:=0;fixed boolean;
begin
 if not (studio_access_private.fridge_allowed() or studio_access_private.fridge_manager()) then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 select coalesce(array_agg(value::uuid),array[]::uuid[]) into ids from jsonb_array_elements_text(p_snapshot->'operation_ids');
 scale:=case when (p_snapshot->>'attributed_cost')::numeric>0 then reserve/(p_snapshot->>'attributed_cost')::numeric else 0 end;
 for sale in select s.* from studio_access_private.fridge_sales s where s.id=any(ids) or exists(select 1 from studio_access_private.fridge_receipt_allocations a join studio_access_private.fridge_payments p on p.id=a.payment_id where a.sale_id=s.id and p.operation_id=any(ids)) order by s.created_at,s.id loop
  select coalesce(sum((x->>'quantity')::numeric*(x->>'cost')::numeric),0) into source_cost from jsonb_array_elements(sale.items) x;
  select coalesce(sum(a.amount),0),coalesce(sum(a.cost),0) into paid,attributed from studio_access_private.fridge_receipt_allocations a join studio_access_private.fridge_payments p on p.id=a.payment_id where a.sale_id=sale.id and p.operation_id=any(ids);
  select coalesce(sum(amount),0),least(coalesce(sum(amount),0),coalesce(sum(cost),0)) into paid_total,covered_total from studio_access_private.fridge_receipt_allocations where sale_id=sale.id;
  paid_before:=greatest(0,paid_total-paid);pending_cost:=greatest(0,source_cost-covered_total);pending_total:=pending_total+pending_cost;
  cost_ratio:=case when source_cost>0 then attributed*scale/source_cost else 0 end;pending_ratio:=case when source_cost>0 then pending_cost/source_cost else 0 end;
  for item in select value from jsonb_array_elements(sale.items) loop
   item_cost:=(item->>'quantity')::numeric*(item->>'cost')::numeric;
   fund_rows:=fund_rows||jsonb_build_array(jsonb_build_object('product_id',item->>'id','name',item->>'name','product_type',coalesce(item->>'product_type','resale'),'quantity',(item->>'quantity')::numeric,'cost',item_cost,'recovered',item_cost*cost_ratio,'pending',item_cost*pending_ratio));
   if item->>'product_type'='composite' then
    if jsonb_typeof(item->'components') is distinct from 'array' or jsonb_array_length(item->'components')=0 then composition_complete:=false;
    else
     full_components:=0;
     for part in select value from jsonb_array_elements(item->'components') loop
      raw_cost:=(item->>'quantity')::numeric*(part->>'quantity')::numeric*(part->>'unit_cost')::numeric;full_components:=full_components+raw_cost;
      component_rows:=component_rows||jsonb_build_array(jsonb_build_object('product_id',item->>'id','product_name',item->>'name','name',part->>'name','unit',part->>'unit','quantity',(item->>'quantity')::numeric*(part->>'quantity')::numeric,'cost',raw_cost,'recovered',raw_cost*cost_ratio,'pending',raw_cost*pending_ratio));
     end loop;
     if item_cost>full_components then
      raw_cost:=item_cost-full_components;component_rows:=component_rows||jsonb_build_array(jsonb_build_object('product_id',item->>'id','product_name',item->>'name','name','Redondeo del costo del servicio','unit','ajuste','quantity',0,'cost',raw_cost,'recovered',raw_cost*cost_ratio,'pending',raw_cost*pending_ratio));
     end if;
    end if;
   end if;
   if paid>0 then
    if jsonb_typeof(item->'pricing'->'percentages') is distinct from 'array' or item->'pricing'->>'config_revision' is null then complete:=false;
    else
     for fee,ord in select value,ordinality from jsonb_array_elements(item->'pricing'->'percentages') with ordinality loop
      fixed:=fee->>'type'='fixed';
      if coalesce(fixed,false) then base:=(item->>'quantity')::numeric;after_part:=base*(fee->>'amount')::numeric*paid_total/sale.amount;before_part:=base*(fee->>'amount')::numeric*paid_before/sale.amount;
      else base:=(item->>'quantity')::numeric*(item->>'price')::numeric;after_part:=base*(fee->>'percent')::numeric/100*paid_total/sale.amount;before_part:=base*(fee->>'percent')::numeric/100*paid_before/sale.amount;end if;
      due:=greatest(0,trunc(after_part,2)-trunc(before_part,2));
      fee_rows:=fee_rows||jsonb_build_array(jsonb_build_object('key','sheet-'||(item->'pricing'->>'config_revision')||'-'||ord,'kind',case when fee->>'key' in ('seller','chief','operations','technical','manager') then 'commission' when fee->>'key'='profit' then 'company' else 'fund' end,'name',fee->>'label','config_revision',(item->'pricing'->>'config_revision')::bigint,'basis',case when coalesce(fixed,false) then 'unit' else 'sale' end,'base',base*paid/sale.amount,'percent',case when not coalesce(fixed,false) then (fee->>'percent')::numeric end,'fixed_amount',case when coalesce(fixed,false) then (fee->>'amount')::numeric end,'amount',due));
     end loop;
    end if;
   end if;
  end loop;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('product_id',id,'name',name,'product_type',kind,'quantity',qty,'cost',cost,'recovered',trunc(recovered,2),'pending',round(pending,2)) order by name,id),'[]') into products from (select x->>'product_id' id,x->>'name' name,x->>'product_type' kind,sum((x->>'quantity')::numeric) qty,sum((x->>'cost')::numeric) cost,sum((x->>'recovered')::numeric) recovered,sum((x->>'pending')::numeric) pending from jsonb_array_elements(fund_rows) x group by 1,2,3) q;
 select coalesce(jsonb_agg(jsonb_build_object('product_id',id,'product_name',product_name,'name',name,'unit',unit,'quantity',qty,'cost',cost,'recovered',trunc(recovered,2),'pending',round(pending,2)) order by product_name,name,unit),'[]') into components from (select x->>'product_id' id,x->>'product_name' product_name,x->>'name' name,x->>'unit' unit,sum((x->>'quantity')::numeric) qty,sum((x->>'cost')::numeric) cost,sum((x->>'recovered')::numeric) recovered,sum((x->>'pending')::numeric) pending from jsonb_array_elements(component_rows) x group by 1,2,3,4) q;
 select coalesce(jsonb_agg(jsonb_build_object('key',key,'kind',kind,'name',name,'config_revision',revision,'basis',basis,'base',round(q.base,6),'percent',percent,'fixed_amount',fixed_amount,'amount',amount) order by revision,key),'[]') into distribution from (select x->>'key' key,x->>'kind' kind,x->>'name' name,(x->>'config_revision')::bigint revision,x->>'basis' basis,(x->>'percent')::numeric percent,(x->>'fixed_amount')::numeric fixed_amount,sum((x->>'base')::numeric) base,sum((x->>'amount')::numeric) amount from jsonb_array_elements(fee_rows) x group by 1,2,3,4,5,6,7) q;
 select coalesce(sum((x->>'amount')::numeric),0) into fee_total from jsonb_array_elements(distribution) x;
 select coalesce(sum((x->>'recovered')::numeric),0) into fund_total from jsonb_array_elements(products) x;
 surplus:=case when complete then greatest(0,receipts-reserve-fee_total) else 0 end;shortfall:=greatest(0,(p_snapshot->>'attributed_cost')::numeric+fee_total-receipts);
 distribution:=jsonb_build_array(jsonb_build_object('key','cost-reserve','kind','reserve','name','Fondo de insumos · costo recuperado','basis','cost','amount',reserve))||distribution;
 if surplus>0 then distribution:=distribution||jsonb_build_array(jsonb_build_object('key','company-surplus','kind','company','name','Excedente de venta y ajuste de centavos','basis','residual','amount',surplus));end if;
 return jsonb_build_object('schema',2,'products',products,'components',components,'reserve',reserve,'pending_cost',pending_total,'rounding_adjustment',reserve-fund_total,'distribution',distribution,'pricing_complete',complete,'composition_complete',composition_complete,'shortfall',shortfall,'available_after_cost',greatest(0,receipts-reserve));
end $$;
alter function studio_access_private.fridge_reconciliation_snapshot(uuid) rename to fridge_reconciliation_snapshot_before_funds;
revoke all on function studio_access_private.fridge_reconciliation_snapshot_before_funds(uuid) from public,anon,authenticated;
create function studio_access_private.fridge_reconciliation_snapshot(p_report uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;begin r:=studio_access_private.fridge_reconciliation_snapshot_before_funds(p_report);return r||jsonb_build_object('cost_settlement',studio_access_private.fridge_cost_settlement(r));end $$;
alter function studio_access_private.fridge_reconciliation_detail(uuid) rename to fridge_reconciliation_detail_before_funds;
revoke all on function studio_access_private.fridge_reconciliation_detail_before_funds(uuid) from public,anon,authenticated;
create function studio_access_private.fridge_reconciliation_detail(p_report uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r studio_access_private.fridge_reconciliations%rowtype;d jsonb;begin
 if not (studio_access_private.fridge_allowed() or studio_access_private.fridge_manager()) then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 select * into r from studio_access_private.fridge_reconciliations where id=p_report;if not found then raise exception 'Cuadre no encontrado';end if;
 d:=r.snapshot->'cost_settlement';if d is null then return studio_access_private.fridge_reconciliation_detail_before_funds(p_report);end if;
 return to_jsonb(r)||jsonb_build_object('proposed_distribution',case when r.status='confirmed' then r.distribution else d->'distribution' end,'current_plan_revision',0,'plan_ready',(d->>'pricing_complete')::boolean and (d->>'composition_complete')::boolean,'payments_recorded',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at,p.id) from studio_access_private.fridge_disbursements p where p.reconciliation_id=r.id),'[]'));
end $$;
alter function studio_access_private.fridge_reconciliation_command(uuid,text,jsonb) rename to fridge_reconciliation_command_before_funds;
revoke all on function studio_access_private.fridge_reconciliation_command_before_funds(uuid,text,jsonb) from public,anon,authenticated;
create function studio_access_private.fridge_reconciliation_command(p_id uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r studio_access_private.fridge_reconciliations%rowtype;d jsonb;paid numeric;kind text;
begin
 if not (studio_access_private.fridge_allowed() or studio_access_private.fridge_manager()) then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 if exists(select 1 from studio_access_private.fridge_reconciliation_events where request_id=p_id) then return studio_access_private.fridge_reconciliation_command_before_funds(p_id,p_action,p_payload);end if;
 if p_action in ('approve','disburse') then
  if not studio_access_private.fridge_manager() then raise exception 'Solo el Manager General puede revisar el reparto' using errcode='42501';end if;
  select * into r from studio_access_private.fridge_reconciliations where id=(p_payload->>'report_id')::uuid for update;d:=r.snapshot->'cost_settlement';
  if d is not null then
   if p_action='approve' then
    if not (d->>'pricing_complete')::boolean or not (d->>'composition_complete')::boolean then raise exception 'Faltan fichas o composiciones históricas. Revisa el desglose antes de aprobar';end if;
    if (d->>'shortfall')::numeric>0 and (not coalesce((p_payload->>'shortfall_ack')::boolean,false) or length(btrim(coalesce(p_payload->>'note','')))<5) then raise exception 'Confirma expresamente el faltante e indica cómo se atenderá';end if;
   else
    select x->>'kind' into kind from jsonb_array_elements(r.distribution) x where x->>'key'=p_payload->>'line_key';
    if kind is distinct from 'reserve' then
     select coalesce(sum(p.amount),0) into paid from studio_access_private.fridge_disbursements p where p.reconciliation_id=r.id and p.line_key<>'cost-reserve';
     if paid+(p_payload->>'amount')::numeric>(d->>'available_after_cost')::numeric then raise exception 'El pago excede el cobro disponible después de reservar el fondo de insumos';end if;
    end if;
   end if;
  end if;
 end if;
 return studio_access_private.fridge_reconciliation_command_before_funds(p_id,p_action,p_payload);
end $$;
-- Expose each report's scheme so only historical reports offer the former profit-based plan.
do $$declare d text;begin d:=pg_get_functiondef('studio_access_private.fridge_reconciliation_state()'::regprocedure);if position('''confirmed_at'',confirmed_at' in d)=0 then raise exception 'Revisa el listado de cuadres antes de migrar';end if;d:=replace(d,'''confirmed_at'',confirmed_at','''settlement_schema'',coalesce((snapshot->''cost_settlement''->>''schema'')::integer,1),''confirmed_at'',confirmed_at');execute d;end $$;
revoke all on function studio_access_private.fridge_cost_settlement(jsonb),studio_access_private.fridge_reconciliation_snapshot(uuid),studio_access_private.fridge_reconciliation_detail(uuid),studio_access_private.fridge_reconciliation_command(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function studio_access_private.fridge_reconciliation_detail(uuid),studio_access_private.fridge_reconciliation_command(uuid,text,jsonb) to authenticated;
