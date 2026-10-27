-- Deliberate capability API: only the read RPC is anonymous; tables stay private.
CREATE SCHEMA IF NOT EXISTS hr_training_private;
REVOKE ALL ON SCHEMA hr_training_private FROM PUBLIC, anon, authenticated;
CREATE TABLE hr_training_private.content_links (
 token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
 trial_id uuid NOT NULL REFERENCES public.hr_trial_periods(id) ON DELETE CASCADE,
 role_id uuid NOT NULL REFERENCES public.hr_roles(id) ON DELETE CASCADE,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 revoked_at timestamptz
);
CREATE INDEX content_links_trial ON hr_training_private.content_links(trial_id);
ALTER TABLE hr_training_private.content_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hr_training_private.content_links FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.hr_issue_training_content(p_trial uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.hr_trial_periods%rowtype; rid uuid; tok text; expiry timestamptz;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(studio_access_private.is_owner(),false) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 SELECT * INTO t FROM public.hr_trial_periods WHERE id=p_trial FOR UPDATE;
 IF NOT FOUND OR t.superseded_at IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM public.hr_candidates WHERE id=t.candidate_id AND status='trial')
 OR (SELECT payload->>'decision' FROM public.hr_trial_closure_events WHERE trial_id=p_trial AND action='message_opened' AND payload ? 'decision' ORDER BY created_at DESC LIMIT 1) IS DISTINCT FROM 'continue'
 THEN RAISE EXCEPTION 'La candidatura no está en capacitación'; END IF;
 SELECT id INTO STRICT rid FROM public.hr_roles WHERE title=t.role_title;
 -- Serialize on the trial; preparing a new link revokes previous capabilities.
 UPDATE hr_training_private.content_links SET revoked_at=now() WHERE trial_id=p_trial AND revoked_at IS NULL;
 tok:=encode(extensions.gen_random_bytes(32),'hex'); expiry:=now()+interval '7 days';
 INSERT INTO hr_training_private.content_links(token_hash,trial_id,role_id,created_by,expires_at)
 VALUES(encode(sha256(convert_to(tok,'UTF8')),'hex'),p_trial,rid,auth.uid(),expiry);
 RETURN jsonb_build_object('url','https://gestion.elcartelstudio.com/plaza-ficha.html?documento=contenido#token='||tok,'expires_at',expiry,'role_id',rid);
END $$;
REVOKE ALL ON FUNCTION public.hr_issue_training_content(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hr_issue_training_content(uuid) TO authenticated;

CREATE FUNCTION public.hr_revoke_training_content(p_trial uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(studio_access_private.is_owner(),false) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 UPDATE hr_training_private.content_links SET revoked_at=now() WHERE trial_id=p_trial AND revoked_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.hr_revoke_training_content(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hr_revoke_training_content(uuid) TO authenticated;

CREATE FUNCTION public.hr_read_training_content(p_token text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE link hr_training_private.content_links%rowtype; r public.hr_roles%rowtype; rd jsonb; wc jsonb; noms jsonb; related jsonb;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
 SELECT * INTO link FROM hr_training_private.content_links
 WHERE token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') AND revoked_at IS NULL AND expires_at>now();
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.hr_trial_periods t JOIN public.hr_candidates c ON c.id=t.candidate_id
 WHERE t.id=link.trial_id AND t.superseded_at IS NULL AND c.status='trial')
 OR (SELECT payload->>'decision' FROM public.hr_trial_closure_events WHERE trial_id=link.trial_id AND action='message_opened' AND payload ? 'decision' ORDER BY created_at DESC LIMIT 1) IS DISTINCT FROM 'continue' THEN RETURN NULL; END IF;
 SELECT * INTO r FROM public.hr_roles WHERE id=link.role_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 -- Allowlist the generator inputs: no contracts, candidate data, replies or storage paths.
 SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO rd FROM jsonb_each(to_jsonb(r))
 WHERE key=ANY(ARRAY['id','title','area','direct_manager','description','schedule','modality','employment_type','compensation','location','updated_at','work_days','subordinate_workers','payment_frequency','payment_method','currency','trial_period','training_period','trial_compensation_different','trial_compensation_amount','training_compensation_different','training_compensation_amount','variable_income','extra_availability_required','extra_availability_details']);
 SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO wc FROM jsonb_each(coalesce(r.work_content,'{}'))
 WHERE key=ANY(ARRAY['standard','standard_titles','hidden_standard_keys','content_order','custom','protocol_blocks','policy_ids','institutional_info_ids','discipline_ids','evaluation_master']);
 -- Protocol images are not used by this document and must not disclose private paths.
 wc:=jsonb_set(wc,'{protocol_blocks}',coalesce((SELECT jsonb_agg(x-'images') FROM jsonb_array_elements(coalesce(wc->'protocol_blocks','[]')) x),'[]'));
 rd:=rd||jsonb_build_object('work_content',wc);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',n.id,'category',n.category,'key',n.key,'label',n.label,'value',n.value,'notes',CASE WHEN n.category='parametros_evaluacion' THEN n.notes ELSE NULL END,'applies_to_all_roles',n.applies_to_all_roles) ORDER BY n.sort_order,n.label),'[]') INTO noms
 FROM public.hr_nomenclators n WHERE n.active AND n.category IN ('normas_politicas','informacion_institucional','regimen_disciplinario','parametros_evaluacion')
 AND (n.applies_to_all_roles OR (CASE n.category WHEN 'normas_politicas' THEN wc->'policy_ids' WHEN 'informacion_institucional' THEN wc->'institutional_info_ids' WHEN 'regimen_disciplinario' THEN wc->'discipline_ids' ELSE wc#>'{evaluation_master,master_param_ids}' END) ? n.id::text);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title)),'[]') INTO related FROM public.hr_roles
 WHERE (coalesce(rd#>'{subordinate_workers,role_ids}','[]') ? id::text)
 OR id::text=wc#>>'{evaluation_master,evaluator_role_id}' OR lower(trim(title))=lower(trim(r.direct_manager));
 RETURN jsonb_build_object('role',rd,'nomenclators',noms,'roles',related,'expires_at',link.expires_at);
END $$;
REVOKE ALL ON FUNCTION public.hr_read_training_content(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_read_training_content(text) TO anon,authenticated;
