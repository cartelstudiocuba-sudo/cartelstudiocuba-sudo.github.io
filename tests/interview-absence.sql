begin;
create temporary table absence_test_ids(candidate uuid,interview uuid);
grant select on absence_test_ids to authenticated;
with c as (insert into public.hr_candidates(vacancy_id,full_name,whatsapp,status,internal_notes)
 select id,'SYNTHETIC ABSENCE — ROLLBACK','0000000000','interview_scheduled','Evaluación conservada [EVALUACION_ENTREVISTA_V1]1,2,3,4,5,1,2,3,4,5[/EVALUACION_ENTREVISTA_V1]' from public.hr_vacancies limit 1 returning id),
 i as (insert into public.hr_interviews(candidate_id,interview_date,interviewer,interview_notes) select id,current_date,'Entrevistador sintético','{"q0":"Respuesta conservada"}'::jsonb from c returning id,candidate_id)
 insert into absence_test_ids select candidate_id,id from i;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"6418ad20-d0e8-49c0-8d9a-e1da3daf71b6","email":"cartelstudiocuba@gmail.com","role":"authenticated"}',true);
do $$
declare cid uuid; iid uuid; r jsonb; original jsonb; n integer; stamp text;
begin
 select candidate,interview into strict cid,iid from absence_test_ids;
 select to_jsonb(c) into original from public.hr_candidates c where id=cid;
 begin perform public.hr_register_interview_absence(cid,'00000000-0000-0000-0000-000000000000');raise exception 'FAIL: wrong appointment';exception when insufficient_privilege then null;end;
 if (select status from public.hr_candidates where id=cid)<>'interview_scheduled' then raise exception 'FAIL: partial write';end if;
 r:=public.hr_register_interview_absence(cid,iid);
 if r->'candidate'->>'status'<>'talent_pool' or r->'candidate'->>'decision_status'<>'talent_pool' or r->'interview'->>'attendance_status'<>'absent' then raise exception 'FAIL: states';end if;
 if r->'candidate'->'internal_notes' is distinct from original->'internal_notes' or r->'interview'->'interview_notes' <> '{"q0":"Respuesta conservada"}'::jsonb or r->'interview'->>'completed_at' is not null then raise exception 'FAIL: preserved evaluation';end if;
 stamp:=r->'interview'->>'updated_at';
 select count(*) into n from public.hr_candidate_history where candidate_id=cid;
 r:=public.hr_register_interview_absence(cid,iid);
 if r->'interview'->>'updated_at'<>stamp or (select count(*) from public.hr_candidate_history where candidate_id=cid)<>n then raise exception 'FAIL: duplicate';end if;
 if not exists(select 1 from public.hr_candidate_history where candidate_id=cid and event_type='interview_absent' and from_status='interview_scheduled' and to_status='talent_pool') then raise exception 'FAIL: history';end if;
 update public.hr_candidates set status='preselected' where id=cid;
 begin perform public.hr_register_interview_absence(cid,iid);raise exception 'FAIL: stale candidate';exception when check_violation then null;end;
 perform set_config('request.jwt.claims','{"sub":"f0000000-0000-4000-8000-000000000002","email":"synthetic-unprivileged@example.invalid","role":"authenticated"}',true);
 begin perform public.hr_register_interview_absence(cid,iid);raise exception 'FAIL: RLS';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: atomic states, evaluation, answers, history, duplicate retry, stale state, RLS; synthetic records rolled back' as result;
rollback;
