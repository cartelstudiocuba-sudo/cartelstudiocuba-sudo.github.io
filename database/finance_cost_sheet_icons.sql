-- Predefined vector identifiers only; the catalog paths are static client assets.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
insert into studio_access_private.finance_cost_backups(name,definition) select 'icons.'||p.proname,pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace='studio_access_private'::regnamespace and p.proname='finance_cost_command';
alter table studio_access_private.finance_cost_sheets add column icon_code text not null default 'sheet' check(icon_code in ('sheet','building','camera','palette','briefcase','users','wrench','package','headphones','monitor','megaphone','settings','folder'));
alter table studio_access_private.finance_cost_versions add column icon_code text not null default 'sheet' check(icon_code in ('sheet','building','camera','palette','briefcase','users','wrench','package','headphones','monitor','megaphone','settings','folder'));
create or replace function studio_access_private.finance_cost_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<finance>>
declare new_icon text;new_area uuid;area_label text;prior studio_access_private.finance_cost_events%rowtype;sheet studio_access_private.finance_cost_sheets%rowtype;checked jsonb;cfgrows jsonb;r jsonb;new_version integer;cfg_revision bigint;reason text:=btrim(coalesce(p_payload->>'reason',''));new_name text:=btrim(coalesce(p_payload->>'name',''));new_module text:=btrim(coalesce(p_payload->>'module_name',''));
begin
 if not studio_access_private.fridge_manager() then raise exception 'Solo el Manager General puede administrar las fichas de costo' using errcode='42501';end if;
 if p_id is null or p_kind is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Operación no válida';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 select * into prior from studio_access_private.finance_cost_events where id=p_id;
 if found then if prior.actor_id<>auth.uid() or prior.kind<>p_kind or prior.payload<>p_payload then raise exception 'Identificador ya utilizado';end if;return prior.result;end if;
 insert into studio_access_private.finance_cost_events(id,actor_id,actor_name,kind,payload) values(p_id,auth.uid(),studio_access_private.inventory_actor_name(),p_kind,p_payload);
 if p_kind='create' then
  new_icon:=case when p_payload ? 'icon_code' then p_payload->>'icon_code' else 'sheet' end;
  if new_icon is null or new_icon not in ('sheet','building','camera','palette','briefcase','users','wrench','package','headphones','monitor','megaphone','settings','folder') then raise exception 'Selecciona un icono del catálogo';end if;
  new_area:=nullif(p_payload->>'area_id','')::uuid;
  if new_area is null or not exists(select 1 from public.hr_departments where id=new_area) then raise exception 'Selecciona un área válida';end if;
  if length(new_name) not between 1 and 100 or length(new_module) not between 1 and 100 then raise exception 'Indica el nombre de la ficha y el módulo';end if;
  insert into studio_access_private.finance_cost_sheets(name,module_name,area_id,icon_code,draft_dirty,created_by,updated_by) values(new_name,new_module,new_area,new_icon,true,auth.uid(),auth.uid()) returning to_jsonb(finance_cost_sheets.*) into r;
 elsif p_kind in ('draft','activate') then
  select * into sheet from studio_access_private.finance_cost_sheets where id=(p_payload->>'sheet_id')::uuid for update;
  if not found or (p_payload->>'draft_revision')::integer is distinct from sheet.draft_revision then raise exception 'La ficha cambió. Actualiza antes de continuar.';end if;
  if p_kind='draft' then
   new_icon:=case when p_payload ? 'icon_code' then p_payload->>'icon_code' else sheet.icon_code end;
   if new_icon is null or new_icon not in ('sheet','building','camera','palette','briefcase','users','wrench','package','headphones','monitor','megaphone','settings','folder') then raise exception 'Selecciona un icono del catálogo';end if;
   new_area:=case when p_payload ? 'area_id' then nullif(p_payload->>'area_id','')::uuid else sheet.area_id end;
   if new_area is null or not exists(select 1 from public.hr_departments where id=new_area) then raise exception 'Selecciona un área válida';end if;
   if length(new_name) not between 1 and 100 or length(new_module) not between 1 and 100 then raise exception 'Indica el nombre de la ficha y el módulo';end if;
   if sheet.code='fridge_bar' and new_module<>sheet.module_name then raise exception 'La ficha del Bar debe conservar su vínculo con Nevera audiovisual';end if;
   checked:=studio_access_private.finance_cost_validate(p_payload->'rows');
   update studio_access_private.finance_cost_sheets set name=new_name,module_name=new_module,area_id=new_area,icon_code=new_icon,draft_rows=checked->'rows',draft_revision=draft_revision+1,draft_dirty=true,updated_by=auth.uid(),updated_at=now() where id=sheet.id returning to_jsonb(finance_cost_sheets.*) into r;
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
   insert into studio_access_private.finance_cost_versions(sheet_id,version,name,module_name,rows,total_percent,fixed_total,actor_id,actor_name,reason,bar_config_revision,area_id,area_name,icon_code) values(sheet.id,new_version,sheet.name,sheet.module_name,checked->'rows',(checked->>'total_percent')::numeric,(checked->>'fixed_total')::numeric,auth.uid(),studio_access_private.inventory_actor_name(),reason,cfg_revision,sheet.area_id,area_label,sheet.icon_code);
   update studio_access_private.finance_cost_sheets set active_version=new_version,draft_dirty=false,draft_revision=draft_revision+1,updated_by=auth.uid(),updated_at=now() where id=sheet.id returning to_jsonb(finance_cost_sheets.*) into r;
  end if;
 else raise exception 'Operación no válida';end if;
 update studio_access_private.finance_cost_events set result=r where id=p_id;return r;
end $$;
