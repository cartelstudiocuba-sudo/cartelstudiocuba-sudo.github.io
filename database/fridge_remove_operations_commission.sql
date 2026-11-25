select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
do $$
declare s studio_access_private.finance_cost_sheets%rowtype; v studio_access_private.finance_cost_versions%rowtype; r studio_access_private.fridge_reconciliations%rowtype; clean jsonb; cfgrows jsonb; cfg bigint; ver integer; olddist jsonb; newdist jsonb; removed numeric; oldsum numeric; newsum numeric; definition text; needle text:='for fee,ord in select value,ordinality from jsonb_array_elements(item->''pricing''->''percentages'') with ordinality loop'; adjustment_reason text:='Retirada de la comisión del Gestor Operativo y traslado a remanentes por aprobación del CEO';
begin
 select * into strict s from studio_access_private.finance_cost_sheets where code='fridge_bar' for update;
 select * into strict v from studio_access_private.finance_cost_versions where sheet_id=s.id and version=s.active_version;
 if s.draft_dirty then raise exception 'La ficha tiene cambios pendientes'; end if;
 if not exists(select 1 from jsonb_array_elements(v.rows) x where x->>'key'='operations') then raise exception 'La comisión ya fue retirada'; end if;
 select jsonb_agg(x order by ord) into clean from jsonb_array_elements(v.rows) with ordinality t(x,ord) where x->>'key'<>'operations';
 select jsonb_agg(jsonb_build_object('key',x->>'key','label',x->>'label','type',x->>'type','percent',case when x->>'type'='percent' then (x->>'value')::numeric else 0 end,'amount',case when x->>'type'='fixed' then (x->>'value')::numeric else 0 end) order by ord) into cfgrows from jsonb_array_elements(clean) with ordinality t(x,ord);
 insert into studio_access_private.fridge_cost_configs(rows,total,fixed_total,actor_name,reason) values(cfgrows,(select coalesce(sum((x->>'percent')::numeric),0) from jsonb_array_elements(cfgrows) x),(select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(cfgrows) x),'CEO · ajuste autorizado',adjustment_reason) returning revision into cfg;
 select coalesce(max(version),0)+1 into ver from studio_access_private.finance_cost_versions where sheet_id=s.id;
 insert into studio_access_private.finance_cost_versions(sheet_id,version,name,module_name,rows,total_percent,fixed_total,actor_name,reason,bar_config_revision,area_id,area_name,icon_code) select s.id,ver,s.name,s.module_name,clean,c.total,c.fixed_total,'CEO · ajuste autorizado',adjustment_reason,cfg,s.area_id,v.area_name,s.icon_code from studio_access_private.fridge_cost_configs c where c.revision=cfg;
 update studio_access_private.finance_cost_sheets set active_version=ver,draft_rows=clean,draft_dirty=false,draft_revision=draft_revision+1,updated_at=now() where id=s.id;
 insert into studio_access_private.permission_audit(kind,target,before_data,after_data) values('fridge_cost_commission_revision',s.id::text,to_jsonb(v),jsonb_build_object('version',ver,'config_revision',cfg,'rows',clean,'authorization',adjustment_reason));
 select * into strict r from studio_access_private.fridge_reconciliations where number=1 and status='pending' for update;
 if exists(select 1 from studio_access_private.fridge_disbursements where reconciliation_id=r.id) then raise exception 'El cuadre tiene pagos registrados';end if;
 olddist:=r.snapshot->'cost_settlement'->'distribution';
 select coalesce(sum((x->>'amount')::numeric),0) into removed from jsonb_array_elements(olddist) x where x->>'kind'='commission' and x->>'name'='Gestor Operativo';
 if removed<=0 or not exists(select 1 from jsonb_array_elements(olddist) x where x->>'key'='company-surplus') then raise exception 'Revisar distribución del cuadre';end if;
 if coalesce((r.snapshot->'cost_settlement'->>'shortfall')::numeric,0)<>0 then raise exception 'Revisar faltante del cuadre';end if;
 select jsonb_agg(case when x->>'key'='company-surplus' then jsonb_set(x,'{amount}',to_jsonb((x->>'amount')::numeric+removed)) else x end order by ord) into newdist from jsonb_array_elements(olddist) with ordinality t(x,ord) where not (x->>'kind'='commission' and x->>'name'='Gestor Operativo');
 select sum((x->>'amount')::numeric) into oldsum from jsonb_array_elements(olddist) x;
 select sum((x->>'amount')::numeric) into newsum from jsonb_array_elements(newdist) x;
 if oldsum is distinct from newsum then raise exception 'El total del reparto cambió';end if;
 update studio_access_private.fridge_reconciliations set snapshot=jsonb_set(snapshot,'{cost_settlement,distribution}',newdist),revision=revision+1 where id=r.id;
 insert into studio_access_private.permission_audit(kind,target,before_data,after_data) values('fridge_pending_commission_adjustment',r.id::text,jsonb_build_object('revision',r.revision,'distribution',olddist),jsonb_build_object('revision',r.revision+1,'distribution',newdist,'authorization',adjustment_reason));
 -- New settlements, including later collections of earlier sales, omit this commission; the original sale snapshots and confirmed reports remain intact.
 definition:=pg_get_functiondef('studio_access_private.fridge_cost_settlement(jsonb)'::regprocedure);
 if strpos(definition,needle)=0 then raise exception 'Revisar función de reparto';end if;
 definition:=replace(definition,needle,needle||' next when fee->>''key''=''operations'';');
 definition:=replace(definition,' next when fee->>''key''=''operations'';',' continue when fee->>''key''=''operations'';');
 execute definition;
end $$;
