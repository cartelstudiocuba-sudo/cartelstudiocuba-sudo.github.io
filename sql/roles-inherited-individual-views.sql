-- Additive transition. Existing assignments, snapshots, Auth accounts and routes stay intact.
alter table public.system_access_roles add column is_catalog_role boolean not null default true;
update public.system_access_roles set is_catalog_role=false where code in ('insumos_melanie_medina','inventario_daniela_dieguez');
update public.system_access_roles set title=case code
 when 'gestor_comercial_grafica' then 'Gestor Operativo (Dpto. Gráfica)'
 when 'jefe_grafica' then 'Jefe de Área (Dpto. Gráfica)'
 when 'jefe_audiovisuales' then 'Jefe de Área (Dpto. Audiovisual)' end
 where code in ('gestor_comercial_grafica','jefe_grafica','jefe_audiovisuales');
insert into public.system_access_roles(code,title,area,description) values
 ('gestor_operativo_audiovisual','Gestor Operativo (Dpto. Audiovisual)','Audiovisuales','Gestión operativa del departamento audiovisual.'),
 ('gestor_tecnico','Gestor Técnico','Administración y Operaciones','Gestión técnica.'),
 ('operario_producciones_graficas','Operario de Producciones Gráficas','Diseño y Producciones Gráficas','Producciones gráficas.'),
 ('disenador_grafico','Diseñador Gráfico','Diseño y Producciones Gráficas','Diseño gráfico.'),
 ('editor','Editor','Audiovisuales','Edición audiovisual.'),
 ('director_creativo','Director Creativo','Dirección Creativa','Dirección creativa.'),
 ('publicista','Publicista','Publicidad','Publicidad.'),
 ('project_manager','Project Manager','Dirección Operativa','Gestión de proyectos.')
 on conflict(code) do nothing;
-- Missing role permissions remain denied until explicitly designed. Do not invent access.
insert into studio_access_private.role_templates(role_id,can_read,can_write,views)
 select id,false,false,'[]'::jsonb from public.system_access_roles r
 where is_catalog_role and not exists(select 1 from studio_access_private.role_templates t where t.role_id=r.id);

create table studio_access_private.individual_view_grants(
 employee_id uuid not null references public.hr_employees(id),
 view_code text not null check(view_code in ('inventory_admin','inventory_graphics_read')),
 permission_level text not null check(permission_level in ('read','write')),
 enabled boolean not null default true,
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 updated_by uuid not null,
 primary key(employee_id,view_code),
 check(view_code<>'inventory_graphics_read' or permission_level='read')
);
alter table studio_access_private.individual_view_grants enable row level security;
revoke all on studio_access_private.individual_view_grants from public,anon,authenticated;

create function studio_access_private.extra_view_permission(p_code text,p_operation text) returns boolean
 language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and p_operation in ('read','write') and exists(
 select 1 from studio_access_private.individual_view_grants g
 join public.hr_employees e on e.id=g.employee_id
 join auth.users u on u.id=e.system_auth_user_id
 where e.system_auth_user_id=auth.uid() and e.system_access_enabled and e.status<>'terminated'
 and u.deleted_at is null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())
 and g.view_code=p_code and g.enabled and (p_operation='read' or g.permission_level='write'))
$$;
revoke all on function studio_access_private.extra_view_permission(text,text) from public,anon;
grant execute on function studio_access_private.extra_view_permission(text,text) to authenticated;

-- The original permission and navigation functions are copied by the release preparation script.

create function studio_access_private.employee_view_access(p_employee uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.hr_employees; s studio_access_private.employee_access_snapshots; old_row jsonb; g studio_access_private.individual_view_grants;
 code text; level text; result jsonb; inherited jsonb;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501';end if;
 select * into e from public.hr_employees where id=p_employee for update;
 if e.id is null then raise exception 'Expediente inexistente';end if;
 select * into s from studio_access_private.employee_access_snapshots where employee_id=e.id;
 inherited:=case when s.view_mode='legacy_template' then s.views else '[]'::jsonb end;
 if p_action='save' then
  if e.status='terminated' or e.system_auth_user_id=auth.uid() then raise exception 'Cuenta protegida o dada de baja';end if;
  code:=p_payload->>'code';level:=p_payload->>'permission_level';
  if code is null or code not in ('inventory_admin','inventory_graphics_read') or level is null or level not in ('read','write')
   or (code='inventory_graphics_read' and level<>'read') or jsonb_typeof(p_payload->'enabled') is distinct from 'boolean'
   then raise exception 'Vista o nivel de permiso no admitido';end if;
  if exists(select 1 from jsonb_array_elements(inherited) v where v->>'code'=code) then raise exception 'Vista heredada: se administra desde el rol';end if;
  -- Legacy grants are retained and separately displayed. Never silently replace their permission model.
  if exists(select 1 from public.system_user_view_assignments v where employee_id=e.id and view_code=code and enabled)
   then raise exception 'Asignación existente protegida durante la transición';end if;
  select * into g from studio_access_private.individual_view_grants where employee_id=e.id and view_code=code;
  if coalesce(g.revision,0) is distinct from (p_payload->>'revision')::integer then raise exception 'La asignación cambió; recarga la ficha';end if;
  old_row:=case when g.employee_id is not null then to_jsonb(g) else null end;
  insert into studio_access_private.individual_view_grants(employee_id,view_code,permission_level,enabled,updated_by)
  values(e.id,code,level,(p_payload->>'enabled')::boolean,auth.uid())
  on conflict(employee_id,view_code) do update set permission_level=excluded.permission_level,enabled=excluded.enabled,
   revision=individual_view_grants.revision+1,updated_at=now(),updated_by=auth.uid() returning * into g;
  insert into studio_access_private.permission_audit(actor_id,kind,target,before_data,after_data)
   values(auth.uid(),'individual_view_'||case when g.enabled then 'granted' else 'removed' end,e.id::text,old_row,to_jsonb(g));
 elsif p_action<>'read' then raise exception 'Acción no admitida';end if;
 return jsonb_build_object(
 'roles',coalesce((select jsonb_agg(jsonb_build_object('code',r.code,'title',r.title,'catalog_role',r.is_catalog_role))
   from public.system_employee_role_assignments a join public.system_access_roles r on r.id=a.access_role_id where a.employee_id=e.id and a.ended_at is null),'[]'),
 'inherited',inherited,'role_permission',jsonb_build_object('read',s.can_read,'write',s.can_write),
 'legacy',coalesce((select jsonb_agg(to_jsonb(v)) from public.system_user_view_assignments v where v.employee_id=e.id and v.enabled),'[]'),
 'additional',coalesce((select jsonb_agg(to_jsonb(v)) from studio_access_private.individual_view_grants v where v.employee_id=e.id),'[]'),
 'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from
   (select created_at,kind,before_data,after_data,actor_id from studio_access_private.permission_audit where target=e.id::text and kind like 'individual_view_%' order by created_at desc limit 50) h),'[]'));
end $$;
revoke all on function studio_access_private.employee_view_access(uuid,text,jsonb) from public,anon;
grant execute on function studio_access_private.employee_view_access(uuid,text,jsonb) to authenticated;
create function public.system_employee_view_access(p_employee uuid,p_action text default 'read',p_payload jsonb default '{}') returns jsonb
 language sql security invoker set search_path='' as $$select studio_access_private.employee_view_access(p_employee,p_action,p_payload)$$;
revoke all on function public.system_employee_view_access(uuid,text,jsonb) from public,anon;
grant execute on function public.system_employee_view_access(uuid,text,jsonb) to authenticated;
