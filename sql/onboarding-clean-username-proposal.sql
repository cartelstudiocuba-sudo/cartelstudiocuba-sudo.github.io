-- Update only the proposal calculation; leave all live guards and actions intact.
do $update$
declare definition text; original text:='translate(c.full_name,';
 replacement text:=$proposal$translate(regexp_replace(trim(c.full_name),'^CANDIDATO DE PRUEBA[[:space:]]*[—–-][[:space:]]*(?=[^[:space:]])','','i'),$proposal$;
begin
 definition:=pg_get_functiondef('studio_access_private.system_onboarding(uuid,text,jsonb)'::regprocedure);
 if position(original in definition)=0 then
  if position(replacement in definition)>0 then return; end if;
  raise exception 'La función cambió. Revisar antes de actualizar la propuesta';
 end if;
 execute replace(definition,original,replacement);
end $update$;
