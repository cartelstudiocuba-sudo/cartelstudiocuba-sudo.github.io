-- Private capabilities. The browser never receives storage paths or privileged keys.
CREATE TABLE hr_training_private.tutor_links (
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 trial_id uuid NOT NULL REFERENCES public.hr_trial_periods(id) ON DELETE CASCADE,
 role_id uuid NOT NULL REFERENCES public.hr_roles(id),
 storage_path text NOT NULL UNIQUE,
 file_ext text NOT NULL CHECK(file_ext IN ('pdf','ppt','pptx','ppsx')),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 revoked_at timestamptz
);
ALTER TABLE hr_training_private.tutor_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hr_training_private.tutor_links FROM PUBLIC,anon,authenticated;
CREATE INDEX tutor_links_trial ON hr_training_private.tutor_links(trial_id);
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('hr-tutor-presentations','hr-tutor-presentations',false,52428800,ARRAY['application/pdf','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.presentationml.slideshow']);

CREATE FUNCTION public.hr_tutor_context(p_trial uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.hr_trial_periods%rowtype; r public.hr_roles%rowtype;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(studio_access_private.is_owner(),false) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 SELECT * INTO t FROM public.hr_trial_periods WHERE id=p_trial;
 IF NOT FOUND OR t.superseded_at IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.hr_candidates WHERE id=t.candidate_id AND status='trial')
 OR (SELECT payload->>'decision' FROM public.hr_trial_closure_events WHERE trial_id=p_trial AND action='message_opened' AND payload ? 'decision' ORDER BY created_at DESC LIMIT 1) IS DISTINCT FROM 'continue'
 THEN RAISE EXCEPTION 'La candidatura no está en capacitación'; END IF;
 SELECT * INTO STRICT r FROM public.hr_roles WHERE title=t.role_title;
 RETURN jsonb_build_object('role_id',r.id,'version',r.updated_at);
END $$;
REVOKE ALL ON FUNCTION public.hr_tutor_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hr_tutor_context(uuid) TO authenticated;

CREATE FUNCTION public.hr_publish_tutor(p_trial uuid,p_path text,p_ext text,p_version text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ctx jsonb; tok text; expiry timestamptz:=now()+interval '7 days';
BEGIN
 PERFORM 1 FROM public.hr_trial_periods WHERE id=p_trial FOR UPDATE;
 ctx:=public.hr_tutor_context(p_trial);
 IF ctx->>'version' IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'La plaza cambió. Vuelve a preparar la presentación'; END IF;
 IF p_ext NOT IN ('pdf','ppt','pptx','ppsx') OR p_path !~ ('^'||(ctx->>'role_id')||'/[a-f0-9-]{36}\.'||p_ext||'$')
 OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='hr-tutor-presentations' AND name=p_path) THEN RAISE EXCEPTION 'Archivo no válido'; END IF;
 UPDATE hr_training_private.tutor_links SET revoked_at=now() WHERE trial_id=p_trial AND revoked_at IS NULL;
 tok:=encode(extensions.gen_random_bytes(32),'hex');
 INSERT INTO hr_training_private.tutor_links(token_hash,trial_id,role_id,storage_path,file_ext,expires_at)
 VALUES(encode(sha256(convert_to(tok,'UTF8')),'hex'),p_trial,(ctx->>'role_id')::uuid,p_path,p_ext,expiry);
 RETURN jsonb_build_object('url','https://gestion.elcartelstudio.com/presentacion-tutor.html#token='||tok,'role_id',ctx->>'role_id','expires_at',expiry);
END $$;
REVOKE ALL ON FUNCTION public.hr_publish_tutor(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hr_publish_tutor(uuid,text,text,text) TO authenticated;

-- Only the Edge Function may resolve a token into an internal storage path.
CREATE FUNCTION public.hr_resolve_tutor(p_token text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE l hr_training_private.tutor_links%rowtype;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
 SELECT * INTO l FROM hr_training_private.tutor_links WHERE token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') AND revoked_at IS NULL AND expires_at>now();
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.hr_trial_periods t JOIN public.hr_candidates c ON c.id=t.candidate_id WHERE t.id=l.trial_id AND t.superseded_at IS NULL AND c.status='trial')
 OR (SELECT payload->>'decision' FROM public.hr_trial_closure_events WHERE trial_id=l.trial_id AND action='message_opened' AND payload ? 'decision' ORDER BY created_at DESC LIMIT 1) IS DISTINCT FROM 'continue' THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('path',l.storage_path,'ext',l.file_ext,'expires_at',l.expires_at);
END $$;
REVOKE ALL ON FUNCTION public.hr_resolve_tutor(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_resolve_tutor(text) TO service_role;

CREATE FUNCTION public.hr_revoke_tutor(p_trial uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(studio_access_private.is_owner(),false) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 UPDATE hr_training_private.tutor_links SET revoked_at=now() WHERE trial_id=p_trial AND revoked_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.hr_revoke_tutor(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hr_revoke_tutor(uuid) TO authenticated;
