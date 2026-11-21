begin;

create or replace function studio_hiring_private.form_view(h public.hr_hiring_cases)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
  'trial_id',h.trial_id,
  'data',studio_hiring_private.consolidated(h),
  'revision',h.revision,
  'locked',h.verified_at is not null or h.employee_id is not null,
  'submitted',h.submitted_at is not null,
  'role_title',h.contract#>>'{role,title}',
  'front',exists(select 1 from storage.objects where (bucket_id='hr-hiring-private' and name=h.trial_id||'/front') or (bucket_id='hr-identity-private' and name=h.inherited_documents->>'front')),
  'back',exists(select 1 from storage.objects where (bucket_id='hr-hiring-private' and name=h.trial_id||'/back') or (bucket_id='hr-identity-private' and name=h.inherited_documents->>'back')),
  'portrait',exists(select 1 from storage.objects where bucket_id='hr-hiring-private' and name=h.trial_id||'/portrait')
 );
$$;
revoke all on function studio_hiring_private.form_view(public.hr_hiring_cases) from public,anon,authenticated;

create or replace function studio_hiring_private.read_case(p_token text,p_document boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h public.hr_hiring_cases;
begin
 h:=studio_hiring_private.current_case(p_token);
 if h.trial_id is null then raise exception 'Enlace no válido, caducado o revocado'; end if;
 if p_document then
  return jsonb_build_object('contract',case when h.signed_at is null then h.contract||jsonb_build_object('renderer_version',2) else h.contract end,
   'data',case when h.signed_at is not null then coalesce(h.contract->'signed_data',h.data) else studio_hiring_private.consolidated(h) end,'revision',h.revision);
 end if;
 return studio_hiring_private.form_view(h);
end $$;

create or replace function studio_hiring_private.preview_form(p_trial uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare h public.hr_hiring_cases;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'No autorizado' using errcode='42501'; end if;
 select * into h from public.hr_hiring_cases where trial_id=p_trial;
 if h.trial_id is null then return null; end if;
 return studio_hiring_private.form_view(h);
end $$;
revoke all on function studio_hiring_private.preview_form(uuid) from public,anon,authenticated;
grant execute on function studio_hiring_private.preview_form(uuid) to authenticated;

create or replace function public.hr_preview_hiring_form(p_trial uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select studio_hiring_private.preview_form(p_trial);
$$;
revoke all on function public.hr_preview_hiring_form(uuid) from public,anon,authenticated;
grant execute on function public.hr_preview_hiring_form(uuid) to authenticated;

commit;
