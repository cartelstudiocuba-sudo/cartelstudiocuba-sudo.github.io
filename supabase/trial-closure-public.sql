CREATE OR REPLACE FUNCTION public.hr_set_trial_closure_representative(p_trial uuid,p_representative jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE c public.hr_trial_closures%rowtype; r jsonb; start_on date; end_on date;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(studio_access_private.is_owner(),false) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 IF jsonb_typeof(p_representative) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Datos incompletos'; END IF;
 IF coalesce(length(trim(p_representative->>'name')),0)<3 OR coalesce(p_representative->>'ci','') !~ '^[0-9]{11}$'
 OR coalesce(length(trim(p_representative->>'address')),0)<5 OR coalesce(length(trim(p_representative->>'position')),0)<2
 OR coalesce(p_representative->>'start_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 OR coalesce(p_representative->>'end_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 THEN RAISE EXCEPTION 'Completa nombre, CI, cargo, dirección y fechas'; END IF;
 start_on:=(p_representative->>'start_date')::date; end_on:=(p_representative->>'end_date')::date;
 IF end_on<start_on THEN RAISE EXCEPTION 'La fecha de fin no puede ser anterior al inicio'; END IF;
 SELECT * INTO c FROM public.hr_trial_closures WHERE trial_id=p_trial FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Acta no encontrada'; END IF;
 IF c.signed_received_at IS NOT NULL OR c.verified_at IS NOT NULL OR c.revoked_at IS NOT NULL OR c.expires_at<=now() THEN RAISE EXCEPTION 'Acta firmada, verificada o sin vigencia; no se modifica'; END IF;
 r:=jsonb_build_object('name',trim(p_representative->>'name'),'ci',p_representative->>'ci','position',trim(p_representative->>'position'),'address',trim(p_representative->>'address'),'start_date',start_on,'end_date',end_on,'observations',coalesce(trim(p_representative->>'observations'),''));
 IF c.document->'representative' IS DISTINCT FROM r THEN
 UPDATE public.hr_trial_closures SET document=jsonb_set(document,'{representative}',r,true) WHERE trial_id=p_trial;
 INSERT INTO public.hr_trial_closure_events(trial_id,action,payload) VALUES(p_trial,'representative_saved',jsonb_build_object('fields',jsonb_build_array('name','ci','position','address','start_date','end_date','observations'),'previously_present',c.document ? 'representative'));
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.hr_set_trial_closure_representative(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hr_set_trial_closure_representative(uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.hr_closure_presentation_allowed(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.hr_trial_closures c
 WHERE c.revoked_at IS NULL AND c.expires_at>now()
 AND c.document_token_hash=encode(sha256(convert_to(coalesce((nullif(current_setting('request.headers',true),'')::jsonb)->>'x-closure-token',''),'UTF8')),'hex')
 AND p_path IN (c.document#>>'{template,presentation,logo_path}',c.document#>>'{template,presentation,watermark_path}')
 AND p_path LIKE 'contract-presentation/%')
$$;
REVOKE ALL ON FUNCTION public.hr_closure_presentation_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_closure_presentation_allowed(text) TO anon,authenticated;
CREATE POLICY "closure_document_presentation_read" ON storage.objects FOR SELECT TO anon,authenticated
USING(bucket_id='hr-role-documents' AND public.hr_closure_presentation_allowed(name));

-- Normalize current templates only. Issued documents remain immutable snapshots.
WITH docs AS (
 SELECT r.id,jsonb_agg(CASE WHEN d->>'key'='trial_close' THEN jsonb_set(d,'{blocks}',(
 SELECT jsonb_agg(CASE WHEN b->>'id'='tcl7' THEN jsonb_set(b,'{text}',to_jsonb(regexp_replace(b->>'text','Cantidad[[:space:]]*[|][[:space:]]*Medio[[:space:]]*/[[:space:]]*recurso.*?(Cualquier incidencia)','\1','s'))) ELSE b END ORDER BY bi)
 FROM jsonb_array_elements(d->'blocks') WITH ORDINALITY z(b,bi))) ELSE d END ORDER BY di) AS documents
 FROM public.hr_roles r CROSS JOIN LATERAL jsonb_array_elements(coalesce(r.work_content#>'{contract_templates,trial,documents}','[]')) WITH ORDINALITY x(d,di) GROUP BY r.id
) UPDATE public.hr_roles r SET work_content=jsonb_set(r.work_content,'{contract_templates,trial,documents}',docs.documents)
FROM docs WHERE r.id=docs.id AND r.work_content#>'{contract_templates,trial,documents}' IS DISTINCT FROM docs.documents;
