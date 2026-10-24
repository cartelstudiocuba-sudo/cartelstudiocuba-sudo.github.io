-- One transaction under the caller's existing RLS policies; no evaluation fields change.
create or replace function public.hr_register_interview_absence(p_candidate uuid, p_interview uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.hr_candidates; iv public.hr_interviews; previous_status text;
begin
 if auth.uid() is null then raise exception 'Se requiere una sesión autorizada.' using errcode='42501'; end if;
 select * into c from public.hr_candidates where id=p_candidate for update;
 if not found then raise exception 'Candidato no disponible o sin autorización.' using errcode='42501'; end if;
 select * into iv from public.hr_interviews where id=p_interview and candidate_id=p_candidate for update;
 if not found then raise exception 'Entrevista no disponible o sin autorización.' using errcode='42501'; end if;
 if c.status='talent_pool' and iv.attendance_status='absent' and iv.completed_at is null then
  return jsonb_build_object('candidate',to_jsonb(c),'interview',to_jsonb(iv));
 end if;
 if c.status<>'interview_scheduled' or iv.completed_at is not null then
  raise exception 'La entrevista o el estado del candidato cambió. Recarga la agenda.' using errcode='23514';
 end if;
 previous_status:=c.status;
 update public.hr_interviews set attendance_status='absent',updated_at=clock_timestamp()
 where id=iv.id returning * into iv;
 if not found then raise exception 'No se pudo registrar la ausencia.' using errcode='42501'; end if;
 update public.hr_candidates set status='talent_pool',decision_status='talent_pool',decision_updated_at=clock_timestamp()
 where id=c.id returning * into c;
 if not found then raise exception 'No se pudo actualizar el candidato.' using errcode='42501'; end if;
 insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note)
 values(c.id,'interview_absent',previous_status,c.status,
  jsonb_build_object('interview_id',iv.id,'actor',auth.uid(),'reason','Ausencia a entrevista; Cantera para futuras entrevistas')::text);
 return jsonb_build_object('candidate',to_jsonb(c),'interview',to_jsonb(iv));
end $$;
revoke all on function public.hr_register_interview_absence(uuid,uuid) from public,anon;
grant execute on function public.hr_register_interview_absence(uuid,uuid) to authenticated;
