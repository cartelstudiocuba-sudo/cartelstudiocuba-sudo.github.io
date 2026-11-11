-- Narrow, invoker-only API. Existing RLS remains authoritative.
create or replace function public.hr_edit_candidate_personal(
  p_candidate_id uuid, p_changes jsonb default '{}'::jsonb,
  p_expected jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  c public.hr_candidates%rowtype;
  a public.hr_candidate_answers%rowtype;
  vals jsonb;
  k text; v jsonb; s text;
  allowed constant text[] := array['sex','address','education_level','identity_card','landline_phone','home_address',
    'interview_email','interview_identity_card','interview_home_address','interview_residence_municipality','interview_landline_phone','photo_path'];
begin
  if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then
    raise exception 'No tienes permiso para editar candidatos.' using errcode='42501';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'object' or jsonb_typeof(p_expected) is distinct from 'object' then
    raise exception 'Formato de cambios inválido.';
  end if;
  select * into c from public.hr_candidates where id=p_candidate_id for update;
  if not found then raise exception 'Candidato no disponible.'; end if;
  perform 1 from public.hr_candidate_answers where candidate_id=p_candidate_id for update;
  vals := jsonb_build_object('full_name',c.full_name,'whatsapp',c.whatsapp,'email',c.email,'municipality',c.municipality);
  for a in select * from public.hr_candidate_answers where candidate_id=p_candidate_id and question_key=any(allowed) loop
    vals := vals || jsonb_build_object('answer:'||a.question_key,a.answer);
  end loop;
  vals := jsonb_build_object('answer:photo_path',null)||vals;
  for k,v in select * from jsonb_each(p_changes) loop
    if not (vals ? k) then raise exception 'Campo no editable: %',k; end if;
    if not (p_expected ? k) or (vals->k) is distinct from (p_expected->k) then
      raise exception 'Los datos cambiaron desde que abriste el editor. Cancela y vuelve a abrirlo para revisar la versión actual.' using errcode='40001';
    end if;
    if jsonb_typeof(v) not in ('string','null') then raise exception 'Valor inválido.'; end if;
    s := coalesce(v#>>'{}','');
    if length(s)>1000 then raise exception 'El dato es demasiado largo.'; end if;
    if k='full_name' and length(btrim(s))<2 then raise exception 'Escribe el nombre y apellidos.'; end if;
    if k in ('email','answer:interview_email') and s<>'' and s !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Revisa el correo electrónico.'; end if;
    if k in ('answer:identity_card','answer:interview_identity_card') and s<>'' and s !~ '^[0-9]{11}$' then raise exception 'El carné de identidad debe tener 11 dígitos.'; end if;
    if k in ('whatsapp','answer:landline_phone','answer:interview_landline_phone') and s<>'' and (s !~ '^\+?[0-9 ()-]+$' or length(regexp_replace(s,'[^0-9]','','g')) not between 6 and 15) then raise exception 'Revisa el teléfono.'; end if;
    if k='answer:photo_path' and (s !~ ('^interview-photos/'||p_candidate_id::text||'/[a-zA-Z0-9.-]+\.(jpg|png|webp|heic)$') or not exists(select 1 from storage.objects where bucket_id='hr-candidate-files' and name=s)) then raise exception 'Fotografía no disponible.'; end if;
  end loop;
  -- Patch only changed columns; protected process fields never enter this UPDATE.
  if p_changes ?| array['full_name','whatsapp','email','municipality'] then
    update public.hr_candidates set
      full_name=case when p_changes ? 'full_name' then p_changes->>'full_name' else full_name end,
      whatsapp=case when p_changes ? 'whatsapp' then p_changes->>'whatsapp' else whatsapp end,
      email=case when p_changes ? 'email' then p_changes->>'email' else email end,
      municipality=case when p_changes ? 'municipality' then p_changes->>'municipality' else municipality end
    where id=p_candidate_id returning * into c;
  end if;
  for k,v in select * from jsonb_each(p_changes) where key like 'answer:%' loop
    s:=substr(k,8);
    update public.hr_candidate_answers set answer=v where candidate_id=p_candidate_id and question_key=s;
    if not found then
      insert into public.hr_candidate_answers(candidate_id,question_key,question_text,answer) values(p_candidate_id,s,'Fotografía del candidato',v);
    end if;
  end loop;
  return jsonb_build_object('values',vals||p_changes,'candidate',to_jsonb(c),'answers',coalesce((select jsonb_agg(to_jsonb(r)) from public.hr_candidate_answers r where candidate_id=p_candidate_id and question_key=any(allowed)),'[]'::jsonb));
end $$;
revoke all on function public.hr_edit_candidate_personal(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.hr_edit_candidate_personal(uuid,jsonb,jsonb) to authenticated;

