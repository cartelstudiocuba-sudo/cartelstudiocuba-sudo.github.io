-- Keep existing signatures, permissions and document allowlists.
do $$
declare item record; definition text; patched text;
begin
 for item in select p.oid,p.proname from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('get_hr_trial_agreement_public','hr_prepare_trial_agreement','hr_trial_agreement_preview','hr_guard_candidate_workflow_status','hr_require_trial_closure','hr_transfer_trial_file','hr_manage_trial_closure') loop
  definition:=pg_get_functiondef(item.oid);patched:=definition;
  case item.proname
   when 'get_hr_trial_agreement_public' then patched:=replace(patched,'where t.candidate_id = p_candidate','where t.candidate_id = p_candidate and t.superseded_at is null');
   when 'hr_prepare_trial_agreement' then patched:=replace(patched,'where candidate_id=p_candidate for update','where candidate_id=p_candidate and superseded_at is null for update');
   when 'hr_trial_agreement_preview' then patched:=replace(patched,'where t.candidate_id=p_candidate order by','where t.candidate_id=p_candidate and t.superseded_at is null order by');
   when 'hr_guard_candidate_workflow_status' then patched:=replace(patched,'where t.candidate_id=new.id and t.stage','where t.candidate_id=new.id and t.superseded_at is null and t.stage');
   when 'hr_require_trial_closure' then
    patched:=replace(patched,'where candidate_id=new.candidate_id and stage','where candidate_id=new.candidate_id and superseded_at is null and stage');
    patched:=replace(patched,'where t.candidate_id=new.candidate_id;','where t.candidate_id=new.candidate_id and t.superseded_at is null;');
   when 'hr_transfer_trial_file' then patched:=replace(patched,'where t.candidate_id=new.candidate_id and c.verified_at','where t.candidate_id=new.candidate_id and t.superseded_at is null and c.verified_at');
   when 'hr_manage_trial_closure' then patched:=replace(patched,$old$if not found then raise exception 'Prueba no encontrada'; end if;$old$,$new$if not found then raise exception 'Prueba no encontrada'; end if; if t.superseded_at is not null then raise exception 'Esta prueba pertenece a un intento anterior. Actualiza la ficha'; end if;$new$);
  end case;
  if patched=definition then raise exception 'Expected function pattern missing: %',item.proname; end if;
  execute patched;
 end loop;
end $$;
