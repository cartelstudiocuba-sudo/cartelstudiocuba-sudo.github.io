-- Run as postgres via SQL editor. All test changes are rolled back.
begin;
select set_config('request.jwt.claims','{"sub":"6418ad20-d0e8-49c0-8d9a-e1da3daf71b6","role":"authenticated"}',true);
set local role authenticated;
do $$ declare cid uuid; response jsonb; token text; payload jsonb;
begin
 select candidate_id into cid from public.hr_trial_periods limit 1;
 if cid is null then raise exception 'No trial fixture available'; end if;
 response:=public.hr_prepare_trial_agreement(cid,'{"name":"Prueba temporal","ci":"12345678901","address":"Dirección de prueba"}');
 token:=split_part(response->>'candidate_url','#token=',2);
 payload:=public.hr_read_trial_agreement(token);
 if payload is null or payload#>>'{representative,name}' <> 'Prueba temporal'
 or payload#>'{hr_candidates,whatsapp}' is not null or payload ? 'candidate_id' or payload ? 'notes'
 then raise exception 'Snapshot isolation failed'; end if;
 if public.hr_read_trial_agreement(repeat('0',64)) is not null then raise exception 'Invalid token accepted'; end if;
 if public.hr_trial_agreement_preview(cid)->'representative' <> payload->'representative' then raise exception 'Preview mismatch'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.hr_prepare_trial_agreement('00000000-0000-0000-0000-000000000001','{}');
  raise exception 'Unauthorized preparation allowed';
 exception when insufficient_privilege then null; end;
 if exists(select 1 from public.hr_trial_periods) or exists(select 1 from public.hr_trial_agreement_links)
 then raise exception 'RLS leak'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 if has_function_privilege('anon','public.get_hr_trial_agreement_public(uuid)','execute')
 or has_function_privilege('anon','public.hr_prepare_trial_agreement(uuid,jsonb)','execute')
 then raise exception 'Anon administrative permission'; end if;
 if public.hr_read_trial_agreement(repeat('f',64)) is not null then raise exception 'Invalid capability'; end if;
end $$;
rollback;
