-- Manual reminders: opening WhatsApp never confirms delivery.
create table studio_access_private.interview_reminders(
 id uuid primary key default gen_random_uuid(),interview_id uuid not null references public.hr_interviews(id),
 slot text not null,opened_at timestamptz,opened_by uuid,confirmed_at timestamptz,confirmed_by uuid,
 unique(interview_id,slot));
alter table studio_access_private.interview_reminders enable row level security;
revoke all on studio_access_private.interview_reminders from public,anon,authenticated;
create function studio_access_private.interview_reminder(p_action text,p_interview uuid,p_expected text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.hr_interviews%rowtype;person public.hr_candidates%rowtype;slot_key text;tomorrow date:=(now() at time zone 'America/Havana')::date+1;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo RRHH autorizado' using errcode='42501';end if;
 if p_action<>'list' then
  select * into i from public.hr_interviews where id=p_interview for update;
  if not found then raise exception 'Entrevista no disponible';end if;
  select * into person from public.hr_candidates where id=i.candidate_id;
  if i.interview_date is distinct from tomorrow or person.status<>'interview_scheduled' or i.completed_at is not null or i.attendance_status not in ('pending','confirmed') then raise exception 'La entrevista ya no corresponde a los recordatorios de mañana. Actualiza la lista';end if;
  slot_key:=i.interview_date::text||'T'||coalesce(i.interview_time::text,'');
  if p_expected is distinct from slot_key then raise exception 'La cita cambió. Actualiza antes de notificar';end if;
  if length(regexp_replace(coalesce(person.whatsapp,''),'[^0-9]','','g'))<8 or i.interview_time is null then raise exception 'Falta un teléfono o una hora válidos';end if;
  if p_action='opened' then
   insert into studio_access_private.interview_reminders(interview_id,slot,opened_at,opened_by) values(i.id,slot_key,now(),auth.uid()) on conflict(interview_id,slot) do nothing;
  elsif p_action='confirm' then
   update studio_access_private.interview_reminders set confirmed_at=now(),confirmed_by=auth.uid() where interview_id=i.id and slot=slot_key and opened_at is not null and confirmed_at is null;
   if found then insert into studio_access_private.permission_audit(actor_id,kind,target,after_data) values(auth.uid(),'interview_reminder_confirm',person.id::text,jsonb_build_object('interview',i.id,'slot',slot_key));
   elsif not exists(select 1 from studio_access_private.interview_reminders where interview_id=i.id and slot=slot_key and confirmed_at is not null) then raise exception 'Abre primero el recordatorio individual y confirma después el envío';end if;
  else raise exception 'Acción no admitida';end if;
 end if;
 return jsonb_build_object('date',tomorrow,'timezone','America/Havana','rows',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'candidate_id',c.id,'full_name',c.full_name,'position',coalesce(vac.title,c.profiled_target_role),'date',v.interview_date,'time',v.interview_time,'phone',c.whatsapp,'slot',v.interview_date::text||'T'||coalesce(v.interview_time::text,''),'opened_at',m.opened_at,'confirmed_at',m.confirmed_at,'confirmed_by',m.confirmed_by) order by v.interview_time,c.full_name) from public.hr_interviews v join public.hr_candidates c on c.id=v.candidate_id left join public.hr_vacancies vac on vac.id=c.vacancy_id left join studio_access_private.interview_reminders m on m.interview_id=v.id and m.slot=v.interview_date::text||'T'||coalesce(v.interview_time::text,'') where v.interview_date=tomorrow and c.status='interview_scheduled' and v.completed_at is null and v.attendance_status in ('pending','confirmed')),'[]'));
end $$;
revoke all on function studio_access_private.interview_reminder(text,uuid,text) from public,anon;
grant execute on function studio_access_private.interview_reminder(text,uuid,text) to authenticated;
create function public.hr_interview_reminders(p_action text default 'list',p_interview uuid default null,p_expected text default null) returns jsonb language sql set search_path='' as $$select studio_access_private.interview_reminder(p_action,p_interview,p_expected)$$;
revoke all on function public.hr_interview_reminders(text,uuid,text) from public,anon;
grant execute on function public.hr_interview_reminders(text,uuid,text) to authenticated;
