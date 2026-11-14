-- Area classification reuses the department registry without granting new permissions.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
insert into studio_access_private.finance_cost_backups(name,definition)
 select 'areas.'||p.proname,pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace='studio_access_private'::regnamespace and p.proname in ('finance_cost_state','finance_cost_command');
alter table studio_access_private.finance_cost_sheets add column area_id uuid references public.hr_departments(id) on delete set null;
create index finance_cost_sheets_area_idx on studio_access_private.finance_cost_sheets(area_id);
alter table studio_access_private.finance_cost_versions add column area_id uuid,add column area_name text;
-- Classify the known bar sheet only; historical versions and other sheets are not rewritten.
update studio_access_private.finance_cost_sheets set area_id=(select id from public.hr_departments where lower(btrim(name)) in ('audiovisuales','audiovisual') order by created_at,id limit 1) where code='fridge_bar' and area_id is null;
create or replace function studio_access_private.finance_cost_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not studio_access_private.fridge_manager() then raise exception 'Solo el Manager General puede administrar las fichas de costo' using errcode='42501';end if;
 return jsonb_build_object('manager',true,'areas',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name) order by d.name) from public.hr_departments d),'[]'),'sheets',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('active',(select to_jsonb(v) from studio_access_private.finance_cost_versions v where v.sheet_id=s.id and v.version=s.active_version)) order by s.created_at,s.id) from studio_access_private.finance_cost_sheets s),'[]'),
 'versions',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc,v.version desc) from studio_access_private.finance_cost_versions v),'[]'));
end $$;
create or replace function studio_access_private.finance_cost_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<finance>>
declare new_area uuid;area_label text;prior studio_access_private.finance_cost_events%rowtype;sheet studio_access_private.finance_cost_sheets%rowtype;checked jsonb;cfgrows jsonb;r jsonb;new_version integer;cfg_revision bigint;reason text:=btrim(coalesce(p_payload->>'reason',''));new_name text:=btrim(coalesce(p_payload->>'name',''));new_module text:=btrim(coalesce(p_payload->>'module_name',''));
begin
 if not studio_access_private.fridge_manager() then raise exception 'Solo el Manager General puede administrar las fichas de costo' using errcode='42501';end if;
 if p_id is null or p_kind is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Operación no válida';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 select * into prior from studio_access_private.finance_cost_events where id=p_id;
 if found then if prior.actor_id<>auth.uid() or prior.kind<>p_kind or prior.payload<>p_payload then raise exception 'Identificador ya utilizado';end if;return prior.result;end if;
 insert into studio_access_private.finance_cost_events(id,actor_id,actor_name,kind,payload) values(p_id,auth.uid(),studio_access_private.inventory_actor_name(),p_kind,p_payload);
 if p_kind='create' then
  new_area:=nullif(p_payload->>'area_id','')::uuid;
  if new_area is null or not exists(select 1 from public.hr_departments where id=new_area) then raise exception 'Selecciona un área válida';end if;
  if length(new_name) not between 1 and 100 or length(new_module) not between 1 and 100 then raise exception 'Indica el nombre de la ficha y el módulo';end if;
  insert into studio_access_private.finance_cost_sheets(name,module_name,area_id,draft_dirty,created_by,updated_by) values(new_name,new_module,new_area,true,auth.uid(),auth.uid()) returning to_jsonb(finance_cost_sheets.*) into r;
 elsif p_kind in ('draft','activate') then
  select * into sheet from studio_access_private.finance_cost_sheets where id=(p_payload->>'sheet_id')::uuid for update;
  if not found or (p_payload->>'draft_revision')::integer is distinct from sheet.draft_revision then raise exception 'La ficha cambió. Actualiza antes de continuar.';end if;
  if p_kind='draft' then
   new_area:=case when p_payload ? 'area_id' then nullif(p_payload->>'area_id','')::uuid else sheet.area_id end;
   if new_area is null or not exists(select 1 from public.hr_departments where id=new_area) then raise exception 'Selecciona un área válida';end if;
   if length(new_name) not between 1 and 100 or length(new_module) not between 1 and 100 then raise exception 'Indica el nombre de la ficha y el módulo';end if;
   if sheet.code='fridge_bar' and new_module<>sheet.module_name then raise exception 'La ficha del Bar debe conservar su vínculo con Nevera audiovisual';end if;
   checked:=studio_access_private.finance_cost_validate(p_payload->'rows');
   update studio_access_private.finance_cost_sheets set name=new_name,module_name=new_module,area_id=new_area,draft_rows=checked->'rows',draft_revision=draft_revision+1,draft_dirty=true,updated_by=auth.uid(),updated_at=now() where id=sheet.id returning to_jsonb(finance_cost_sheets.*) into r;
  else
   select name into area_label from public.hr_departments where id=sheet.area_id;
   if area_label is null then raise exception 'Selecciona un área válida antes de activar la ficha';end if;
   if not sheet.draft_dirty then raise exception 'No hay un borrador nuevo para activar';end if;
   if length(reason) not between 5 and 2000 or coalesce((p_payload->>'confirm_activation')::boolean,false) is not true then raise exception 'Confirma la activación e indica el motivo';end if;
   checked:=studio_access_private.finance_cost_validate(sheet.draft_rows);
   select coalesce(max(version),0)+1 into new_version from studio_access_private.finance_cost_versions where sheet_id=sheet.id;
   if sheet.code='fridge_bar' then
    select jsonb_agg(jsonb_build_object('key',x->>'key','label',x->>'label','type',x->>'type','percent',case when x->>'type'='percent' then (x->>'value')::numeric else 0 end,'amount',case when x->>'type'='fixed' then (x->>'value')::numeric else 0 end) order by ord) into cfgrows from jsonb_array_elements(checked->'rows') with ordinality t(x,ord);
    insert into studio_access_private.fridge_cost_configs(rows,total,fixed_total,created_by,actor_name,reason) values(cfgrows,(checked->>'total_percent')::numeric,(checked->>'fixed_total')::numeric,auth.uid(),studio_access_private.inventory_actor_name(),reason) returning revision into cfg_revision;
   end if;
   insert into studio_access_private.finance_cost_versions(sheet_id,version,name,module_name,rows,total_percent,fixed_total,actor_id,actor_name,reason,bar_config_revision,area_id,area_name) values(sheet.id,new_version,sheet.name,sheet.module_name,checked->'rows',(checked->>'total_percent')::numeric,(checked->>'fixed_total')::numeric,auth.uid(),studio_access_private.inventory_actor_name(),reason,cfg_revision,sheet.area_id,area_label);
   update studio_access_private.finance_cost_sheets set active_version=new_version,draft_dirty=false,draft_revision=draft_revision+1,updated_by=auth.uid(),updated_at=now() where id=sheet.id returning to_jsonb(finance_cost_sheets.*) into r;
  end if;
 else raise exception 'Operación no válida';end if;
 update studio_access_private.finance_cost_events set result=r where id=p_id;return r;
end $$;
