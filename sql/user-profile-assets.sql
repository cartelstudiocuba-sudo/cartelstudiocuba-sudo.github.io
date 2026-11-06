-- Extend the existing assignment register; no employee or historical records are changed.
alter table public.hr_employee_assets add column asset_code text;
alter table public.hr_employee_assets add column assigned_by uuid references auth.users(id);
alter table public.hr_employee_assets add column returned_by uuid references auth.users(id);
create unique index employee_asset_active_code on public.hr_employee_assets(lower(btrim(asset_code))) where returned_at is null and asset_code is not null;

create function studio_access_private.user_profile(p_employee uuid,p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.hr_employees%rowtype;u auth.users%rowtype;result jsonb;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501';end if;
 if p_employee is not null then select * into e from public.hr_employees where id=p_employee;if not found then raise exception 'No existe el expediente';end if;end if;
 select * into u from auth.users where id=coalesce(e.system_auth_user_id,p_user);
 result:=jsonb_build_object('employee',case when e.id is null then null else to_jsonb(e) end,
 'account',jsonb_build_object('created_at',u.created_at,'last_sign_in_at',u.last_sign_in_at,'confirmed',u.email_confirmed_at is not null,'blocked',coalesce(u.banned_until>now(),false)),
 'can_manage_assets',e.id is not null and e.status<>'terminated',
 'position',(select jsonb_build_object('id',r.id,'title',r.title,'area',r.area,'department',d.name,'employment_type',r.employment_type) from public.hr_roles r left join public.hr_departments d on d.id=r.department_id where r.id=e.role_id),
 'contract',(select jsonb_build_object('trial_id',h.trial_id,'signed_at',h.signed_at,'verified_at',h.verified_at,'created_at',h.created_at,'data',h.data,'available',h.contract is not null,'portrait',h.inherited_documents->>'portrait') from public.hr_hiring_cases h where h.employee_id=e.id),
 'documents',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.hr_employee_documents d where d.employee_id=e.id),'[]'),
 'assets',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('receipt_state',r.state,'resolution',r.resolution,'resolved_at',r.resolved_at,'checked_at',r.checked_at,'receipt_notes',r.notes,'receipt_actor',r.actor) order by a.assigned_at desc) from public.hr_employee_assets a left join studio_offboarding_private.cases c on c.employee_id=a.employee_id left join studio_offboarding_private.receipts r on r.case_id=c.id and r.asset_id=a.id where a.employee_id=e.id),'[]'),
 'offboarding',(select jsonb_build_object('id',c.id,'reason',c.reason,'effective_on',c.effective_on,'created_at',c.created_at,'finalized_at',c.finalized_at,'revision',c.revision) from studio_offboarding_private.cases c where c.employee_id=e.id),
 'performance',coalesce((select jsonb_agg(jsonb_build_object('completed_at',t.completed_at,'stage',t.stage,'data',c.data,'verified_at',c.verified_at)) from public.hr_trial_periods t join public.hr_trial_closures c on c.trial_id=t.id where t.candidate_id=e.candidate_id and c.data is not null and c.data<>'{}'::jsonb),'[]'),
 'history',coalesce((select jsonb_agg(x order by x->>'created_at' desc) from (
 select jsonb_build_object('created_at',created_at,'action',event_type,'description',note) x from public.hr_candidate_history where candidate_id=e.candidate_id
 union all select jsonb_build_object('created_at',changed_at,'action','Cambio de rol','actor',actor_id,'description',role_code||case when new_active then ' · asignado' else ' · retirado' end) from studio_access_private.role_audit where target_id=e.system_auth_user_id
 union all select jsonb_build_object('created_at',created_at,'action',kind,'actor',actor_id,'description',after_data) from studio_access_private.permission_audit where target in (e.id::text,e.system_auth_user_id::text)
 union all select jsonb_build_object('created_at',v.created_at,'action',v.action,'actor',v.actor,'description',v.details) from studio_offboarding_private.events v join studio_offboarding_private.cases c on c.id=v.case_id where c.employee_id=e.id
 ) history),'[]'));
 return result;
end $$;
revoke all on function studio_access_private.user_profile(uuid,uuid) from public,anon;
grant execute on function studio_access_private.user_profile(uuid,uuid) to authenticated;
create function public.system_user_profile(p_employee uuid default null,p_user uuid default null) returns jsonb language sql set search_path='' as $$select studio_access_private.user_profile(p_employee,p_user)$$;
revoke all on function public.system_user_profile(uuid,uuid) from public,anon;
grant execute on function public.system_user_profile(uuid,uuid) to authenticated;

create function studio_access_private.employee_asset(p_employee uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.hr_employees%rowtype;a public.hr_employee_assets%rowtype;c studio_offboarding_private.cases%rowtype;before_row jsonb;code text;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501';end if;
 select * into e from public.hr_employees where id=p_employee for update;
 if not found then raise exception 'No existe el trabajador';end if;
 if e.status='terminated' then raise exception 'Expediente dado de baja: asignaciones inmutables';end if;
 select * into c from studio_offboarding_private.cases where employee_id=e.id for update;
 if c.finalized_at is not null then raise exception 'Baja archivada';end if;
 if p_action='assign' then
  if c.id is not null then raise exception 'Cierre en trámite: no se permiten nuevas entregas';end if;
  code:=upper(btrim(coalesce(p_payload->>'asset_code','')));
  if length(code)<2 or length(code)>100 or length(btrim(coalesce(p_payload->>'description','')))<3 or length(btrim(coalesce(p_payload->>'asset_type','')))<2 then raise exception 'Identifica el medio, su categoría y su código único';end if;
  perform pg_advisory_xact_lock(hashtextextended(code,0));
  if exists(select 1 from public.hr_employee_assets where lower(btrim(asset_code))=lower(code) and returned_at is null) then raise exception 'El medio ya tiene una asignación activa';end if;
  if (p_payload->>'assigned_on')::date is null or (p_payload->>'assigned_on')::date>current_date or (p_payload->>'assigned_on')::date<e.hired_at::date then raise exception 'Fecha de entrega no válida';end if;
  insert into public.hr_employee_assets(employee_id,asset_code,asset_type,description,assigned_at,assigned_by,notes) values(e.id,code,left(btrim(p_payload->>'asset_type'),100),left(btrim(p_payload->>'description'),500),(p_payload->>'assigned_on')::date,auth.uid(),left(coalesce(p_payload->>'notes',''),10000)) returning * into a;
 elsif p_action='return' then
  select * into a from public.hr_employee_assets where id=(p_payload->>'asset_id')::uuid and employee_id=e.id for update;
  if not found then raise exception 'Medio ajeno a este trabajador';end if;
  if a.returned_at is not null then raise exception 'El medio ya fue devuelto';end if;
  if length(btrim(coalesce(p_payload->>'notes','')))<3 then raise exception 'Documenta la devolución';end if;
  before_row:=to_jsonb(a);
  if c.id is not null then
   if (p_payload->>'revision')::integer is distinct from c.revision then raise exception 'La baja cambió. Actualiza la ficha';end if;
   perform studio_offboarding_private.manage(e.id,'receipt',jsonb_build_object('revision',c.revision,'asset_id',a.id,'state','received','notes',p_payload->>'notes'));
   update public.hr_employee_assets set returned_by=auth.uid() where id=a.id returning * into a;
  else update public.hr_employee_assets set returned_at=now(),returned_by=auth.uid() where id=a.id returning * into a;
  end if;
 else raise exception 'Acción no admitida';end if;
 insert into studio_access_private.permission_audit(actor_id,kind,target,before_data,after_data) values(auth.uid(),'employee_asset_'||p_action,e.id::text,before_row,to_jsonb(a)||jsonb_build_object('operation_notes',left(coalesce(p_payload->>'notes',''),10000)));
 return studio_access_private.user_profile(e.id,null);
end $$;
revoke all on function studio_access_private.employee_asset(uuid,text,jsonb) from public,anon;
grant execute on function studio_access_private.employee_asset(uuid,text,jsonb) to authenticated;
create function public.system_employee_asset(p_employee uuid,p_action text,p_payload jsonb default '{}') returns jsonb language sql set search_path='' as $$select studio_access_private.employee_asset(p_employee,p_action,p_payload)$$;
revoke all on function public.system_employee_asset(uuid,text,jsonb) from public,anon;
grant execute on function public.system_employee_asset(uuid,text,jsonb) to authenticated;
