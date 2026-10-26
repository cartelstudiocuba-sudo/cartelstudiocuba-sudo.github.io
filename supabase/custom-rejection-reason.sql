-- Preserve deployed function body and privileges, replacing only reason validation.
do $$
declare definition text; patched text;
begin
 definition:=pg_get_functiondef('public.hr_manage_trial_closure(uuid,text,jsonb)'::regprocedure);
 patched:=replace(definition,
 $old$coalesce(p_payload->>'reason','') not in ('No asistió a la entrevista','No es el candidato idóneo')$old$,
 $new$length(btrim(coalesce(p_payload->>'reason',''))) not between 1 and 1000$new$);
 if patched=definition then raise exception 'Expected reason validation missing'; end if;
 execute patched;
end $$;
