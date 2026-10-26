-- Presentation cleanup only; stored/signed act snapshots and their audit history remain intact.
create or replace function public.hr_clean_trial_closure_template(doc jsonb)
returns jsonb language sql immutable set search_path=''
as $clean$
 select case when doc->>'key'='trial_close' and jsonb_typeof(doc->'blocks')='array' then
 jsonb_set(doc,'{blocks}',coalesce((
 select jsonb_agg(
 b || (select coalesce(jsonb_object_agg(k,
 to_jsonb(regexp_replace(regexp_replace(b->>k,
 E'(\\\\n|\\n)*Resumen de asuntos pendientes u observaciones:[\\s\\S]*$','','i'),
 ' De existir alguna excepción o asunto económico pendiente, deberá quedar expresamente consignado en la cláusula «Asuntos pendientes u observaciones» de esta acta\\.','','g'))),'{}'::jsonb)
 from unnest(array['text','override_text']) k where jsonb_typeof(b->k)='string')
 order by ord)
 from jsonb_array_elements(doc->'blocks') with ordinality x(b,ord)
 where b->>'id' is distinct from 'tcl10'
 ),'[]'::jsonb)) else doc end
$clean$;
update public.hr_roles r set work_content=jsonb_set(work_content,'{contract_templates,trial,documents}',
 (select jsonb_agg(public.hr_clean_trial_closure_template(d) order by ord)
 from jsonb_array_elements(work_content #> '{contract_templates,trial,documents}') with ordinality x(d,ord)))
where work_content #> '{contract_templates,trial,documents}' @> '[{"key":"trial_close"}]';

-- Preserve all existing token/expiry/revocation checks, and expose the exact return destination.
do $patch$
declare definition text;
begin
 select pg_get_functiondef('public.hr_read_trial_closure(text,boolean)'::regprocedure) into definition;
 if position('if p_document then return c.document; end if;' in definition)=0 then
  raise exception 'Unexpected hr_read_trial_closure definition; aborting';
 end if;
 definition:=replace(definition,'if p_document then return c.document; end if;',
 'if p_document then return jsonb_set(c.document,''{template}'',public.hr_clean_trial_closure_template(c.document->''template'')) || jsonb_build_object(''candidate_id'',(select t.candidate_id from public.hr_trial_periods t where t.id=c.trial_id)); end if;');
 execute definition;
end $patch$;
