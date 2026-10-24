begin;
create temporary table completion_test_ids(candidate uuid,interview uuid);
grant select on completion_test_ids to authenticated;
with c as (insert into public.hr_candidates(vacancy_id,full_name,whatsapp,status)
 select id,'SYNTHETIC INTERVIEW COMPLETION — ROLLBACK','0000000000','interview_scheduled' from public.hr_vacancies limit 1 returning id),
 i as (insert into public.hr_interviews(candidate_id,interview_date,interviewer) select id,current_date,'Entrevistador sintético' from c returning id,candidate_id)
 insert into completion_test_ids select candidate_id,id from i;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"6418ad20-d0e8-49c0-8d9a-e1da3daf71b6","email":"cartelstudiocuba@gmail.com","role":"authenticated"}',true);
do $$
declare cid uuid; iid uuid; result jsonb; stamp timestamptz; n integer; notes jsonb='{}';
begin
 select candidate,interview into strict cid,iid from completion_test_ids;
 begin perform public.hr_finalize_interview(cid,'[1,2,3,4,5,1,2,3,4,5]','pending','Prueba');raise exception 'FAIL: questionnaire bypass';exception when check_violation then null;end;
 if exists(select 1 from public.hr_interviews where id=iid and completed_at is not null) then raise exception 'FAIL: partial closure';end if;
 for n in 0..15 loop notes:=notes||jsonb_build_object('q'||n,'Respuesta sintética '||n);end loop;
 update public.hr_interviews set interview_notes=notes where id=iid;
 update public.hr_candidates set internal_notes='[EVALUACION_ENTREVISTA_V1]1,2,3,4,5,1,2,3,4,5[/EVALUACION_ENTREVISTA_V1]' where id=cid;
 if exists(select 1 from public.hr_interviews where id=iid and completed_at is not null) then raise exception 'FAIL: evaluation saved closes interview';end if;
 begin perform public.hr_finalize_interview(cid,'[1,2,3,4,5,1,2,3,4,0]','pending','Prueba');raise exception 'FAIL: zero rating';exception when check_violation then null;end;
 begin perform public.hr_finalize_interview(cid,'[1,2,3,4,5,1,2,3,4,null]','pending','Prueba');raise exception 'FAIL: null rating';exception when check_violation then null;end;
 begin perform public.hr_finalize_interview(cid,'[1,2,3,4,5,1,2,3,4,5]','','Prueba');raise exception 'FAIL: no decision';exception when check_violation then null;end;
 update public.hr_interviews set interviewer='' where id=iid;
 begin perform public.hr_finalize_interview(cid,'[1,2,3,4,5,1,2,3,4,5]','pending','Prueba');raise exception 'FAIL: no interviewer';exception when check_violation then null;end;
 update public.hr_interviews set interviewer='Entrevistador sintético',interview_date=null where id=iid;
 begin perform public.hr_finalize_interview(cid,'[1,2,3,4,5,1,2,3,4,5]','pending','Prueba');raise exception 'FAIL: no date';exception when check_violation then null;end;
 update public.hr_interviews set interview_date=current_date,interview_notes=notes||'{"q1_choice":"No responde / no se abordó"}' where id=iid;
 begin perform public.hr_finalize_interview(cid,'[1,2,3,4,5,1,2,3,4,5]','pending','Prueba');raise exception 'FAIL: unanswered selection';exception when check_violation then null;end;
 update public.hr_interviews set interview_notes=notes where id=iid;
 result:=public.hr_finalize_interview(cid,'[1,2,3,4,5,1,2,3,4,5]','pending','Prueba');
 stamp:=(result->'interview'->>'completed_at')::timestamptz;
 if stamp is null or result->'candidate'->>'status'<>'interviewed' or result->'interview'->>'closure_decision'<>'pending' then raise exception 'FAIL: valid closure';end if;
 result:=public.hr_finalize_interview(cid,'[5,5,5,5,5,5,5,5,5,5]','selected','Duplicado');
 if (result->'interview'->>'completed_at')::timestamptz<>stamp then raise exception 'FAIL: idempotence';end if;
 begin update public.hr_interviews set completed_at=null where id=iid;raise exception 'FAIL: removed closure';exception when check_violation then null;end;
 begin update public.hr_interviews set closure_evaluation=null where id=iid;raise exception 'FAIL: removed evaluation';exception when check_violation then null;end;
 update public.hr_interviews set general_notes='Edición autorizada' where id=iid;
 if (select completed_at from public.hr_interviews where id=iid)<>stamp then raise exception 'FAIL: edited closure date';end if;
 if not exists(select 1 from public.hr_candidate_history where candidate_id=cid and event_type='interview_completed') or not exists(select 1 from public.hr_candidate_history where candidate_id=cid and event_type='interview_evaluation_edited') then raise exception 'FAIL: audit missing';end if;
 perform set_config('request.jwt.claims','{"sub":"f0000000-0000-4000-8000-000000000002","email":"synthetic-unprivileged@example.invalid","role":"authenticated"}',true);
 begin perform public.hr_finalize_interview(cid,'[5,5,5,5,5,5,5,5,5,5]','pending','No autorizado');raise exception 'FAIL: RLS bypass';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: closure, required answers, ratings, decision, date, interviewer, idempotence, audit, authorized editing, RLS. All synthetic writes rolled back.' as result;
rollback;
