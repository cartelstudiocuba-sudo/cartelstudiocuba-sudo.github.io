-- Only synthetic rows are written, and the entire transaction is rolled back.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
select set_config('request.jwt.claims','{"sub":"6418ad20-d0e8-49c0-8d9a-e1da3daf71b6","email":"cartelstudiocuba@gmail.com","role":"authenticated"}',true);
do $$
declare r uuid; v uuid; c uuid; iv public.hr_interviews; result jsonb; stamp timestamptz; d jsonb; j integer;
begin
 for j in 1..3 loop
  d:=jsonb_build_object('version',1,'revision',1,'status','draft','questions',jsonb_build_array(
   jsonb_build_object('id','iq_live_text','section','Prueba','text','Pregunta sintética','help','Guía sintética','type','text','required',true,'options','[]'::jsonb),
   jsonb_build_object('id','iq_live_option','section','Prueba','text','Opción sintética','help','','type','select','required',true,'options','["Sí","No"]'::jsonb),
   jsonb_build_object('id','iq_live_optional','section','Prueba','text','Opcional sintética','help','','type','text','required',false,'options','[]'::jsonb)));
  insert into public.hr_roles(title,status,work_content) values('SYNTHETIC QUESTIONNAIRE ROLLBACK '||gen_random_uuid(),'active',jsonb_build_object('interview_questionnaire_draft',d)) returning id into r;
  insert into public.hr_vacancies(title,slug,status) select title,'synthetic-rollback-'||gen_random_uuid(),'draft' from public.hr_roles where id=r returning id into v;
  insert into public.hr_candidates(vacancy_id,full_name,whatsapp,status) values(v,'SYNTHETIC QUESTIONNAIRE — ROLLBACK','0000000000','interview_scheduled') returning id into c;
  insert into public.hr_interviews(candidate_id,interview_date,interviewer,interview_notes) values(c,current_date,'Entrevistador sintético','{"q3":"Historia intacta"}');
  -- Candidate INSERT is intentionally unavailable to the signed-in UI. Fixtures
  -- are created by the test connection; all application operations use its RLS role.
  set local role authenticated;
  begin perform public.hr_begin_role_questionnaire(c);raise exception 'FAIL: draft activated';exception when check_violation then null;end;
  begin perform public.hr_finalize_interview(c,'[1,2,3,4,5,1,2,3,4,5]','pending','Prueba');raise exception 'FAIL: missing version allowed';exception when check_violation then null;end;
  perform public.hr_publish_role_questionnaire(r,d);
  iv:=public.hr_begin_role_questionnaire(c);
  if iv.questionnaire_snapshot->>'role_id'<>r::text or iv.interview_notes->>'q3'<>'Historia intacta' then raise exception 'FAIL: snapshot/history';end if;
  perform public.hr_save_role_interview_answer(c,'iq_live_text','Respuesta sintética',null,1);
  begin perform public.hr_save_role_interview_answer(c,'iq_live_text','Cambio obsoleto',null,1);raise exception 'FAIL: concurrency bypass';exception when serialization_failure then null;end;
  begin perform public.hr_save_role_interview_answer(c,'iq_live_option','Fuera de opciones',null,1);raise exception 'FAIL: invalid option';exception when check_violation then null;end;
  begin perform public.hr_finalize_interview(c,'[1,2,3,4,5,1,2,3,4,5]','pending','Prueba');raise exception 'FAIL: unanswered required';exception when check_violation then null;end;
  perform public.hr_save_role_interview_answer(c,'iq_live_option','Sí',null,1);
  result:=public.hr_finalize_interview(c,'[1,2,3,4,5,1,2,3,4,5]','pending','Prueba');stamp:=(result->'interview'->>'completed_at')::timestamptz;
  if stamp is null or result->'candidate'->>'status'<>'interviewed' then raise exception 'FAIL: valid closure';end if;
  result:=public.hr_finalize_interview(c,'[]','selected','Repetición');
  if (result->'interview'->>'completed_at')::timestamptz<>stamp then raise exception 'FAIL: closure changed';end if;
  begin update public.hr_interviews set completed_at=null where candidate_id=c;raise exception 'FAIL: closure removed';exception when check_violation then null;end;
  if exists(select 1 from public.hr_interviews where candidate_id=c and interview_notes->>'q3'<>'Historia intacta') then raise exception 'FAIL: history overwritten';end if;
  reset role;
 end loop;
end $$;
rollback;
select 'PASS: three synthetic roles, authorized RLS, draft/publication, snapshot, required/optional, concurrency, options, closure and repeated closure; all writes rolled back' as result;
