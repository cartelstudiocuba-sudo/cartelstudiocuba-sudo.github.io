-- Central cost-sheet administration. Existing bar history and prices remain intact.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
create table studio_access_private.finance_cost_backups(name text primary key,definition text not null);
insert into studio_access_private.finance_cost_backups select n.nspname||'.'||p.proname,pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname='system_my_navigation') or (n.nspname='studio_access_private' and p.proname in ('fridge_pricing_authorize','fridge_pricing_snapshot','fridge_pricing_state','fridge_pricing_command'));
alter table studio_access_private.fridge_cost_configs add column fixed_total numeric(12,2) not null default 0 check(fixed_total>=0);
create table studio_access_private.finance_cost_sheets(
 id uuid primary key default gen_random_uuid(),code text unique,name text not null check(length(btrim(name)) between 1 and 100),
 module_name text not null check(length(btrim(module_name)) between 1 and 100),currency text not null default 'USD' check(currency='USD'),
 draft_rows jsonb not null default '[]',draft_revision integer not null default 1,draft_dirty boolean not null default false,
 active_version integer,created_by uuid,created_at timestamptz not null default now(),updated_by uuid,updated_at timestamptz not null default now()
);
create table studio_access_private.finance_cost_versions(
 sheet_id uuid not null references studio_access_private.finance_cost_sheets(id),version integer not null,
 name text not null,module_name text not null,rows jsonb not null,total_percent numeric(5,2) not null check(total_percent>=0 and total_percent<100),fixed_total numeric(12,2) not null check(fixed_total>=0),
 actor_id uuid,actor_name text not null,created_at timestamptz not null default now(),reason text not null,bar_config_revision bigint references studio_access_private.fridge_cost_configs(revision),primary key(sheet_id,version)
);
alter table studio_access_private.finance_cost_sheets add constraint finance_cost_active_version_fk foreign key(id,active_version) references studio_access_private.finance_cost_versions(sheet_id,version) deferrable initially deferred;
create table studio_access_private.finance_cost_events(
 id uuid primary key,actor_id uuid not null,actor_name text not null,kind text not null,payload jsonb not null,result jsonb,created_at timestamptz not null default now()
);
-- Import all existing bar configurations, rather than generating a second bar standard.
do $$declare sheet uuid;cfg record;rows jsonb;begin
 insert into studio_access_private.finance_cost_sheets(code,name,module_name) values('fridge_bar','Ficha de costo del Bar','Nevera audiovisual') returning id into sheet;
 for cfg in select * from studio_access_private.fridge_cost_configs order by revision loop
  select jsonb_agg(jsonb_build_object('key',x->>'key','label',x->>'label','type','percent','value',(x->>'percent')::numeric) order by ord) into rows from jsonb_array_elements(cfg.rows) with ordinality t(x,ord);
  insert into studio_access_private.finance_cost_versions(sheet_id,version,name,module_name,rows,total_percent,fixed_total,actor_id,actor_name,created_at,reason,bar_config_revision)
  values(sheet,cfg.revision,'Ficha de costo del Bar','Nevera audiovisual',rows,cfg.total,0,cfg.created_by,cfg.actor_name,cfg.created_at,cfg.reason,cfg.revision);
  update studio_access_private.finance_cost_sheets set active_version=cfg.revision,draft_rows=rows where id=sheet;
 end loop;
end $$;
set constraints all immediate;
do $$declare t text;begin foreach t in array array['finance_cost_backups','finance_cost_sheets','finance_cost_versions','finance_cost_events'] loop
 execute format('alter table studio_access_private.%I enable row level security',t);
 execute format('revoke all on studio_access_private.%I from public,anon,authenticated',t);
 execute format('create policy %I on studio_access_private.%I as restrictive for all to anon,authenticated using(false) with check(false)',t||'_no_direct',t);
end loop;end $$;
create function studio_access_private.finance_cost_validate(p_rows jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare line jsonb;v numeric;total numeric:=0;fixed numeric:=0;clean jsonb:='[]';keys text[]:=array[]::text[];k text;label text;kind text;
begin
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 100 then raise exception 'Agrega entre 1 y 100 conceptos a la ficha';end if;
 for line in select value from jsonb_array_elements(p_rows) loop
  k:=btrim(coalesce(line->>'key',''));label:=btrim(coalesce(line->>'label',''));kind:=line->>'type';v:=(line->>'value')::numeric;
  if length(k) not between 1 and 100 or k=any(keys) or length(label) not between 1 and 120 then raise exception 'Revisa los nombres e identificadores de los conceptos';end if;
  if kind is null or kind not in ('percent','fixed') or v is null or v<0 or v>9999999999.99 or v::text in ('NaN','Infinity','-Infinity') or v<>round(v,2) then raise exception 'Concepto o importe inválido';end if;
  keys:=array_append(keys,k);if kind='percent' then total:=total+v;else fixed:=fixed+v;end if;
  clean:=clean||jsonb_build_array(jsonb_build_object('key',k,'label',label,'type',kind,'value',v));
 end loop;
 if total>=100 then raise exception 'La suma de porcentajes debe ser inferior al 100 %%';end if;
 if fixed>9999999999.99 then raise exception 'Los gastos fijos exceden el máximo admitido';end if;
 return jsonb_build_object('rows',clean,'total_percent',total,'fixed_total',fixed);
end $$;
create function studio_access_private.finance_cost_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not studio_access_private.fridge_manager() then raise exception 'Solo el Manager General puede administrar las fichas de costo' using errcode='42501';end if;
 return jsonb_build_object('manager',true,'sheets',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('active',(select to_jsonb(v) from studio_access_private.finance_cost_versions v where v.sheet_id=s.id and v.version=s.active_version)) order by s.created_at,s.id) from studio_access_private.finance_cost_sheets s),'[]'),
 'versions',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc,v.version desc) from studio_access_private.finance_cost_versions v),'[]'));
end $$;
create function studio_access_private.finance_cost_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<finance>>
declare prior studio_access_private.finance_cost_events%rowtype;sheet studio_access_private.finance_cost_sheets%rowtype;checked jsonb;cfgrows jsonb;r jsonb;new_version integer;cfg_revision bigint;reason text:=btrim(coalesce(p_payload->>'reason',''));new_name text:=btrim(coalesce(p_payload->>'name',''));new_module text:=btrim(coalesce(p_payload->>'module_name',''));
begin
 if not studio_access_private.fridge_manager() then raise exception 'Solo el Manager General puede administrar las fichas de costo' using errcode='42501';end if;
 if p_id is null or p_kind is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Operación no válida';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 select * into prior from studio_access_private.finance_cost_events where id=p_id;
 if found then if prior.actor_id<>auth.uid() or prior.kind<>p_kind or prior.payload<>p_payload then raise exception 'Identificador ya utilizado';end if;return prior.result;end if;
 insert into studio_access_private.finance_cost_events(id,actor_id,actor_name,kind,payload) values(p_id,auth.uid(),studio_access_private.inventory_actor_name(),p_kind,p_payload);
 if p_kind='create' then
  if length(new_name) not between 1 and 100 or length(new_module) not between 1 and 100 then raise exception 'Indica el nombre de la ficha y el módulo';end if;
  insert into studio_access_private.finance_cost_sheets(name,module_name,draft_dirty,created_by,updated_by) values(new_name,new_module,true,auth.uid(),auth.uid()) returning to_jsonb(finance_cost_sheets.*) into r;
 elsif p_kind in ('draft','activate') then
  select * into sheet from studio_access_private.finance_cost_sheets where id=(p_payload->>'sheet_id')::uuid for update;
  if not found or (p_payload->>'draft_revision')::integer is distinct from sheet.draft_revision then raise exception 'La ficha cambió. Actualiza antes de continuar.';end if;
  if p_kind='draft' then
   if length(new_name) not between 1 and 100 or length(new_module) not between 1 and 100 then raise exception 'Indica el nombre de la ficha y el módulo';end if;
   if sheet.code='fridge_bar' and new_module<>sheet.module_name then raise exception 'La ficha del Bar debe conservar su vínculo con Nevera audiovisual';end if;
   checked:=studio_access_private.finance_cost_validate(p_payload->'rows');
   update studio_access_private.finance_cost_sheets set name=new_name,module_name=new_module,draft_rows=checked->'rows',draft_revision=draft_revision+1,draft_dirty=true,updated_by=auth.uid(),updated_at=now() where id=sheet.id returning to_jsonb(finance_cost_sheets.*) into r;
  else
   if not sheet.draft_dirty then raise exception 'No hay un borrador nuevo para activar';end if;
   if length(reason) not between 5 and 2000 or coalesce((p_payload->>'confirm_activation')::boolean,false) is not true then raise exception 'Confirma la activación e indica el motivo';end if;
   checked:=studio_access_private.finance_cost_validate(sheet.draft_rows);
   select coalesce(max(version),0)+1 into new_version from studio_access_private.finance_cost_versions where sheet_id=sheet.id;
   if sheet.code='fridge_bar' then
    select jsonb_agg(jsonb_build_object('key',x->>'key','label',x->>'label','type',x->>'type','percent',case when x->>'type'='percent' then (x->>'value')::numeric else 0 end,'amount',case when x->>'type'='fixed' then (x->>'value')::numeric else 0 end) order by ord) into cfgrows from jsonb_array_elements(checked->'rows') with ordinality t(x,ord);
    insert into studio_access_private.fridge_cost_configs(rows,total,fixed_total,created_by,actor_name,reason) values(cfgrows,(checked->>'total_percent')::numeric,(checked->>'fixed_total')::numeric,auth.uid(),studio_access_private.inventory_actor_name(),reason) returning revision into cfg_revision;
   end if;
   insert into studio_access_private.finance_cost_versions(sheet_id,version,name,module_name,rows,total_percent,fixed_total,actor_id,actor_name,reason,bar_config_revision) values(sheet.id,new_version,sheet.name,sheet.module_name,checked->'rows',(checked->>'total_percent')::numeric,(checked->>'fixed_total')::numeric,auth.uid(),studio_access_private.inventory_actor_name(),reason,cfg_revision);
   update studio_access_private.finance_cost_sheets set active_version=new_version,draft_dirty=false,draft_revision=draft_revision+1,updated_by=auth.uid(),updated_at=now() where id=sheet.id returning to_jsonb(finance_cost_sheets.*) into r;
  end if;
 else raise exception 'Operación no válida';end if;
 update studio_access_private.finance_cost_events set result=r where id=p_id;return r;
end $$;
-- Fixed per-unit expenses enter every server-side minimum calculation; old rows default to zero.
do $$declare name text;d text;begin
 foreach name in array array['fridge_pricing_authorize','fridge_pricing_snapshot','fridge_pricing_state','fridge_pricing_command'] loop
  select pg_get_functiondef(p.oid) into strict d from pg_proc p where p.pronamespace='studio_access_private'::regnamespace and p.proname=name;
  d:=replace(d,'fridge_pricing_min((p_context->>''cost'')::numeric,cfg.total)','fridge_pricing_min((p_context->>''cost'')::numeric+cfg.fixed_total,cfg.total)');
  d:=replace(d,'fridge_pricing_min(cost,cfg.total)','fridge_pricing_min(cost+cfg.fixed_total,cfg.total)');
  d:=replace(d,'fridge_pricing_min(p_cost,p_config.total)','fridge_pricing_min(p_cost+p_config.fixed_total,p_config.total)');
  d:=replace(d,'p_cost/(1-p_config.total/100)','(p_cost+p_config.fixed_total)/(1-p_config.total/100)');
  d:=replace(d,'''cost'',p_cost,','''cost'',p_cost,''fixed_total'',p_config.fixed_total,');
  execute d;
 end loop;
end $$;
-- Old price/exception/recipe endpoints stay available; configuration is centralized.
alter function studio_access_private.fridge_pricing_command(uuid,text,jsonb) rename to fridge_pricing_command_before_finance;
revoke all on function studio_access_private.fridge_pricing_command_before_finance(uuid,text,jsonb) from public,anon,authenticated;
create function studio_access_private.fridge_pricing_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not (studio_access_private.fridge_manager() or studio_access_private.fridge_allowed()) then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 if p_kind='config' then raise exception 'Administra los conceptos y porcentajes desde Finanzas → Fichas de costo';end if;
 return studio_access_private.fridge_pricing_command_before_finance(p_id,p_kind,p_payload);
end $$;
create or replace function public.system_my_navigation() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('is_owner',coalesce(studio_access_private.is_owner(),false),'views',public.system_my_views(),'fridge_audiovisual',coalesce(studio_access_private.fridge_allowed(),false),'fridge_manager',coalesce(studio_access_private.fridge_manager(),false),'finance_cost_sheets',coalesce(studio_access_private.fridge_manager(),false))
$$;
create function public.finance_cost_state() returns jsonb language sql stable security invoker set search_path='' as $$select studio_access_private.finance_cost_state()$$;
create function public.finance_cost_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select studio_access_private.finance_cost_command(p_id,p_kind,p_payload)$$;
revoke all on function studio_access_private.finance_cost_validate(jsonb),studio_access_private.finance_cost_state(),studio_access_private.finance_cost_command(uuid,text,jsonb),studio_access_private.fridge_pricing_command(uuid,text,jsonb),public.finance_cost_state(),public.finance_cost_command(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function studio_access_private.finance_cost_state(),studio_access_private.finance_cost_command(uuid,text,jsonb),studio_access_private.fridge_pricing_command(uuid,text,jsonb),public.finance_cost_state(),public.finance_cost_command(uuid,text,jsonb) to authenticated;
