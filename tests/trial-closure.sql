begin;
select set_config('request.jwt.claims','{"sub":"6418ad20-d0e8-49c0-8d9a-e1da3daf71b6","role":"authenticated"}',true);
do $$ declare cid uuid; tid uuid; links jsonb; tok text; dtok text; employee uuid;
begin
 insert into public.hr_candidates(vacancy_id,full_name,whatsapp,status) values((select id from public.hr_vacancies limit 1),'TEST CIERRE ROLLBACK','00000000','trial') returning id into cid;
 insert into public.hr_trial_periods(candidate_id,role_title,start_date,duration_days,stage) values(cid,'Prueba sintética',current_date,7,'evaluation_pending') returning id into tid;
 links:=public.hr_prepare_trial_closure(tid);
 tok:=split_part(links->>'form_url','#token=',2); dtok:=split_part(links->>'document_url','#token=',2);
 if public.hr_read_trial_closure(tok,true) is not null or public.hr_read_trial_closure(dtok,false) is not null then raise exception 'Capabilities not separated'; end if;
 if public.hr_read_trial_closure(repeat('f',64)) is not null then raise exception 'Invalid link accepted'; end if;
 if public.hr_read_trial_closure(dtok,true)->>'full_name'<>'TEST CIERRE ROLLBACK' then raise exception 'Document mismatch'; end if;
 begin perform public.hr_confirm_trial_hire(tid); raise exception 'Early hiring allowed'; exception when raise_exception then if sqlerrm='Early hiring allowed' then raise; end if; end;
 perform set_config('request.headers',jsonb_build_object('x-closure-token',tok)::text,true);
 if not public.hr_closure_upload_allowed(tid::text||'/front') or public.hr_closure_upload_allowed(gen_random_uuid()::text||'/front') then raise exception 'Upload scope failed'; end if;
 insert into storage.objects(bucket_id,name) values('hr-identity-private',tid::text||'/front'),('hr-identity-private',tid::text||'/back');
 perform public.hr_submit_trial_closure(tok,'{"identity_number":"12345678901","address":"Dirección sintética","emergency_name":"Prueba","emergency_phone":"00000000"}');
 if public.hr_closure_upload_allowed(tid::text||'/front') then raise exception 'Upload after submit allowed'; end if;
 perform public.hr_manage_trial_closure(tid,'signed_received');
 perform public.hr_manage_trial_closure(tid,'verified');
 perform public.hr_manage_trial_closure(tid,'training_prepared',jsonb_build_object('days',7,'tutor','Tutor sintético','start',current_date));
 employee:=public.hr_confirm_trial_hire(tid);
 if not exists(select 1 from public.hr_employee_personal_details where employee_id=employee and data->>'identity_number'='12345678901') then raise exception 'File transfer failed'; end if;
 perform public.hr_manage_trial_closure(tid,'revoked');
 if public.hr_read_trial_closure(tok) is not null or public.hr_read_trial_closure(dtok,true) is not null then raise exception 'Revocation failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.hr_trial_closures) then raise exception 'Unauthorized closure read'; end if;
 if exists(select 1 from storage.objects where bucket_id='hr-identity-private') then raise exception 'Unauthorized identity read'; end if;
 begin perform public.hr_prepare_trial_closure(gen_random_uuid()); raise exception 'Unauthorized prepare accepted'; exception when raise_exception then if sqlerrm='Unauthorized prepare accepted' then raise; end if; end;
end $$;
reset role;
set local role anon;
do $$ begin
 if public.hr_closure_upload_allowed('unrelated/front') then raise exception 'Anonymous upload accepted'; end if;
 if exists(select 1 from storage.objects where bucket_id='hr-identity-private') then raise exception 'Public identity read'; end if;
end $$;
rollback;

