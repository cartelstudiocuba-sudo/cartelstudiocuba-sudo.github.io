CREATE OR REPLACE FUNCTION studio_offboarding_private.manage(p_employee uuid, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.hr_employees%rowtype;c studio_offboarding_private.cases%rowtype;h jsonb;t jsonb;tok text;a public.hr_employee_assets%rowtype;v integer;result jsonb;
begin
 if auth.uid() is null or not coalesce(public.system_has_permission('rrhh','write'),false) then raise exception 'Solo RRHH autorizado';end if;
 if p_action='list' then return coalesce((select jsonb_agg(jsonb_build_object('id',c0.id,'employee_id',e0.id,'candidate_id',e0.candidate_id,'full_name',e0.full_name,'role_title',e0.role_title,'reason',c0.reason,'effective_on',c0.effective_on,'finalized_at',c0.finalized_at) order by c0.created_at desc) from studio_offboarding_private.cases c0 join public.hr_employees e0 on e0.id=c0.employee_id),'[]');end if;
 select * into e from public.hr_employees where id=p_employee for update;
 if not found then raise exception 'No existe expediente de trabajador';end if;
 select * into c from studio_offboarding_private.cases where employee_id=e.id for update;
 if p_action='read' and c.id is null then
  select contract into h from public.hr_hiring_cases where employee_id=e.id;
  if h is null then h:=studio_offboarding_private.direct_signed_contract(e.id);end if;
  return jsonb_build_object('employee',jsonb_build_object('id',e.id,'full_name',e.full_name,'role_title',e.role_title,'email',e.email,'whatsapp',e.whatsapp),'contract_available',h is not null,'case',null);
 end if;
 if p_action='start' then
  if c.id is not null then return studio_offboarding_private.manage(e.id,'read','{}');end if;
  if e.status='terminated' or e.system_auth_user_id=auth.uid() then raise exception 'No se puede iniciar esta baja';end if;
  select contract into h from public.hr_hiring_cases where employee_id=e.id and signed_at is not null;
  if h is null then h:=studio_offboarding_private.direct_signed_contract(e.id);end if;
  if h is null then raise exception 'Bloqueo: falta contrato laboral firmado vinculado al expediente';end if;
  select d into t from public.hr_roles r cross join lateral jsonb_array_elements(coalesce(r.work_content->'contract_templates'->'employment'->'documents','[]')) d where r.id=e.role_id and d->>'key'='employment_close' limit 1;
  if t is null then raise exception 'Bloqueo: falta plantilla employment_close en Contratación';end if;
  if length(trim(coalesce(p_payload->>'date_basis','')))<10 then raise exception 'Documenta la base contractual de fechas y días de entrega';end if;
  v:=(p_payload->>'delivery_days')::integer;
  if (p_payload->>'starts_on')::date<e.hired_at::date then raise exception 'El cierre no puede comenzar antes de la contratación';end if;
  insert into studio_offboarding_private.cases(employee_id,reason,starts_on,delivery_days,effective_on,notes,date_basis,contract_snapshot,template_snapshot)
  values(e.id,p_payload->>'reason',(p_payload->>'starts_on')::date,v,(p_payload->>'starts_on')::date+v,left(coalesce(p_payload->>'notes',''),10000),p_payload->>'date_basis',h,t) returning * into c;
 elsif c.id is null then raise exception 'Inicia el procedimiento desde RRHH';
 end if;
 if p_action='notified' and c.notified_at is not null then return studio_offboarding_private.manage(e.id,'read','{}');end if;
 if p_action not in ('start','read') then
  if c.finalized_at is not null then
   if p_action='finalize' then return studio_offboarding_private.manage(e.id,'read','{}');end if;
   raise exception 'Baja definitiva: expediente inmutable';
  end if;
  if (p_payload->>'revision')::integer is distinct from c.revision then raise exception 'El expediente cambió. Recarga antes de continuar';end if;
 end if;
 -- Reconcile real assignments on every read/action. Returned assets remain in the audit.
 insert into studio_offboarding_private.receipts(case_id,asset_id) select c.id,x.id from public.hr_employee_assets x where x.employee_id=e.id and x.returned_at is null on conflict do nothing;
 if p_action='link' then
  tok:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  update studio_offboarding_private.cases set token_hash=encode(sha256(convert_to(tok,'UTF8')),'hex'),expires_at=now()+interval '30 days',revoked_at=null,message='',opened_at=null,notified_at=null where id=c.id;
 elsif p_action='message' then
  if length(trim(coalesce(p_payload->>'message','')))<20 then raise exception 'Notificación incompleta';end if;
  tok:=substring(p_payload->>'message' from '#token=([0-9a-f]{64})');
  if c.expires_at is null or c.expires_at<=now() or tok is null or encode(sha256(convert_to(tok,'UTF8')),'hex') is distinct from c.token_hash
   or position('https://gestion.elcartelstudio.com/cierre-laboral.html#token='||tok in p_payload->>'message')=0
   or position('https://gestion.elcartelstudio.com/cierre-laboral.html?document=1#token='||tok in p_payload->>'message')=0 then raise exception 'Incluye los dos enlaces personales vigentes en la notificación';end if;
  tok:=null;
  update studio_offboarding_private.cases set opened_at=case when message is distinct from left(p_payload->>'message',15000) then null else opened_at end,notified_at=case when message is distinct from left(p_payload->>'message',15000) then null else notified_at end,message=left(p_payload->>'message',15000) where id=c.id;
 elsif p_action='opened' then
  if c.token_hash is null or c.expires_at<=now() or c.message='' then raise exception 'Prepara enlace y mensaje vigente';end if;
  update studio_offboarding_private.cases set opened_at=now() where id=c.id;
 elsif p_action='notified' then
  if c.opened_at is null or p_payload->>'confirm' is distinct from 'ENVIADO' then raise exception 'Confirma explícitamente el envío';end if;
  update studio_offboarding_private.cases set notified_at=now() where id=c.id;
 elsif p_action='inventory' then
  if length(trim(coalesce(p_payload->>'notes','')))<10 then raise exception 'Documenta la comprobación de las asignaciones reales';end if;
  update studio_offboarding_private.cases set inventory_verified_at=now(),inventory_verified_by=auth.uid(),inventory_note=left(p_payload->>'notes',10000) where id=c.id;
 elsif p_action='receipt' then
  select * into a from public.hr_employee_assets where id=(p_payload->>'asset_id')::uuid and employee_id=e.id for update;
  if not found then raise exception 'Medio no asignado a este trabajador';end if;
  if length(trim(coalesce(p_payload->>'notes','')))<3 then raise exception 'Registra observaciones de la verificación';end if;
  if p_payload->>'state' not in ('pending','received','incident') then raise exception 'Estado inválido';end if;
  if coalesce(p_payload->>'resolution','')<>'' and p_payload->>'state'<>'incident' then raise exception 'La resolución corresponde a una incidencia';end if;
  update studio_offboarding_private.receipts set state=p_payload->>'state',actor=auth.uid(),checked_at=now(),notes=left(p_payload->>'notes',10000),resolution=nullif(trim(p_payload->>'resolution'),''),resolved_at=case when length(trim(coalesce(p_payload->>'resolution','')))>=10 then now() end where case_id=c.id and asset_id=a.id;
  if not found then raise exception 'La asignación no pertenece al cierre';end if;
  update public.hr_employee_assets set returned_at=case when p_payload->>'state'='received' then now() else null end where id=a.id;
  update studio_offboarding_private.cases set inventory_verified_at=null where id=c.id;
 elsif p_action='verify_worker' then
  if c.submitted_at is null then raise exception 'Falta formulario del trabajador';end if;
  update studio_offboarding_private.cases set worker_verified_at=now() where id=c.id;
 elsif p_action='document' then
  if length(trim(coalesce(p_payload->>'text','')))<100 then raise exception 'Documento incompleto';end if;
  if c.signed_verified_at is not null then raise exception 'Documento firmado: no se puede sobrescribir';end if;
  update studio_offboarding_private.cases set document_text=left(p_payload->>'text',100000),document_version=document_version+1,document_reviewed_at=now(),signed_path=null where id=c.id;
 elsif p_action='signed' then
  if c.document_reviewed_at is null then raise exception 'RRHH debe revisar y emitir el documento';end if;
  if not exists(select 1 from storage.objects where bucket_id='hr-offboarding-private' and name=p_payload->>'path' and name like c.id::text||'/'||c.document_version::text||'/%') then raise exception 'Falta archivo firmado de la versión vigente';end if;
  update studio_offboarding_private.cases set signed_path=p_payload->>'path',signed_verified_at=now() where id=c.id;
 elsif p_action='finalize' then
  if p_payload->>'confirm' is distinct from 'CONFIRMAR BAJA' then raise exception 'Confirmación explícita requerida';end if;
  if current_date<c.effective_on then raise exception 'Todavía no llegó la fecha efectiva';end if;
  if c.notified_at is null or c.worker_verified_at is null or c.inventory_verified_at is null or c.signed_verified_at is null then raise exception 'Faltan notificación, formulario validado, inventario verificado o documento firmado';end if;
  if exists(select 1 from studio_offboarding_private.receipts where case_id=c.id and (state='pending' or (state='incident' and resolved_at is null))) then raise exception 'Hay medios pendientes o incidencias sin resolver';end if;
  if e.system_auth_user_id=auth.uid() then raise exception 'No puedes dar de baja tu propia cuenta';end if;
  update studio_offboarding_private.cases set finalized_at=now(),finalized_by=auth.uid(),revoked_at=now() where id=c.id;
  update public.hr_employees set status='terminated',system_access_enabled=false,updated_at=now() where id=e.id;
  -- Remove refresh sessions; existing JWTs are denied by status/access checks on every protected operation.
  delete from auth.sessions where user_id=e.system_auth_user_id;
  update public.system_employee_role_assignments set ended_at=now() where employee_id=e.id and ended_at is null;
  update public.system_user_view_assignments set enabled=false,is_default=false where employee_id=e.id;
 elsif p_action not in ('start','read','link') then raise exception 'Acción no permitida';
 end if;
 if p_action<>'read' then
  update studio_offboarding_private.cases set revision=revision+1 where id=c.id;
  insert into studio_offboarding_private.events(case_id,action,actor,details) values(c.id,p_action,auth.uid(),p_payload-'revision'-'message'||case when p_action='document' then jsonb_build_object('version',c.document_version+1) else '{}' end);
 end if;
 select * into c from studio_offboarding_private.cases where id=c.id;
 result:=jsonb_build_object('employee',jsonb_build_object('id',e.id,'full_name',e.full_name,'role_title',e.role_title,'email',e.email,'whatsapp',e.whatsapp),'case',to_jsonb(c)-'token_hash','assets',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('description',x.description,'asset_type',x.asset_type,'assigned_at',x.assigned_at)) from studio_offboarding_private.receipts r join public.hr_employee_assets x on x.id=r.asset_id where r.case_id=c.id),'[]'),'events',coalesce((select jsonb_agg(to_jsonb(ev) order by ev.id) from studio_offboarding_private.events ev where ev.case_id=c.id),'[]'));
 if tok is not null then result:=result||jsonb_build_object('token',tok);end if;
 return result;
end $function$;
