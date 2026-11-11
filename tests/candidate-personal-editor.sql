-- Transactional integration checks: no candidate changes survive this script.
begin;
select set_config('request.jwt.claim.sub','6418ad20-d0e8-49c0-8d9a-e1da3daf71b6',true);
select set_config('request.jwt.claims','{"sub":"6418ad20-d0e8-49c0-8d9a-e1da3daf71b6","email":"cartelstudiocuba@gmail.com","role":"authenticated"}',true);
set local role authenticated;
do $$
declare cid uuid; snap jsonb; result jsonb; oldrow jsonb; newrow jsonb; rejected boolean;
begin
 select id,to_jsonb(c) into cid,oldrow from public.hr_candidates c limit 1;
 if cid is null then raise exception 'Test needs an existing candidate'; end if;
 snap:=public.hr_edit_candidate_personal(cid);
 result:=public.hr_edit_candidate_personal(cid,'{"full_name":"Prueba transaccional"}',jsonb_build_object('full_name',snap->'values'->'full_name'));
 select to_jsonb(c) into newrow from public.hr_candidates c where id=cid;
 if newrow-'full_name' is distinct from oldrow-'full_name' then raise exception 'Unedited data changed';end if;
 if newrow->>'full_name'<>'Prueba transaccional' then raise exception 'Update not persisted';end if;
 rejected:=false;
 begin perform public.hr_edit_candidate_personal(cid,'{"full_name":"Conflicto"}',jsonb_build_object('full_name',snap->'values'->'full_name'));exception when serialization_failure then rejected:=true;end;
 if not rejected then raise exception 'Conflict not rejected';end if;
 rejected:=false;
 begin perform public.hr_edit_candidate_personal(cid,'{"full_name":"Cambio parcial","status":"hired"}','{"full_name":"Prueba transaccional","status":"new"}');exception when others then rejected:=true;end;
 if not rejected then raise exception 'Protected field accepted';end if;
 if (select full_name from public.hr_candidates where id=cid)<>'Prueba transaccional' then raise exception 'Partial write';end if;
 rejected:=false;
 begin perform public.hr_edit_candidate_personal(cid,'{"email":"invalid"}',jsonb_build_object('email',snap->'values'->'email'));exception when others then rejected:=true;end;
 if not rejected then raise exception 'Invalid email accepted';end if;
 rejected:=false;
 begin perform public.hr_edit_candidate_personal(cid,'{"answer:birth_date":"2000-01-01"}','{"answer:birth_date":null}');exception when others then rejected:=true;end;
 if not rejected then raise exception 'Unknown field accepted';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
 rejected:=false;
 begin perform public.hr_edit_candidate_personal(cid);exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Non-owner accepted';end if;
 if has_function_privilege('anon','public.hr_edit_candidate_personal(uuid,jsonb,jsonb)','execute') then raise exception 'Anonymous execution granted';end if;
 raise notice 'PASS owner save, unchanged data, conflict, protected/unknown fields, atomic failure, validation, non-owner and anonymous access';
end $$;
rollback;

