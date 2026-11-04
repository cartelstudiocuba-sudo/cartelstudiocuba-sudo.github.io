-- Keep privileged implementations outside the exposed API schema.
alter function public.system_role_template(uuid,text,jsonb) set schema studio_access_private;
alter function public.system_apply_role_template(uuid,uuid) set schema studio_access_private;
alter function public.system_onboarding(uuid,text,jsonb) set schema studio_access_private;
alter function public.system_onboarding_service(uuid,text,jsonb) set schema studio_access_private;
alter function public.system_activate_onboarding(text) set schema studio_access_private;
alter function public.system_onboarding_activation_ready(text) set schema studio_access_private;
alter function public.system_my_pending_onboarding() set schema studio_access_private;

create function public.system_role_template(p_role uuid,p_action text default 'read',p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select studio_access_private.system_role_template(p_role,p_action,p_payload)$$;
create function public.system_apply_role_template(p_employee uuid,p_role uuid) returns void language sql security invoker set search_path='' as $$select studio_access_private.system_apply_role_template(p_employee,p_role)$$;
create function public.system_onboarding(p_candidate uuid,p_action text default 'read',p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select studio_access_private.system_onboarding(p_candidate,p_action,p_payload)$$;
create function public.system_onboarding_service(p_candidate uuid,p_action text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select studio_access_private.system_onboarding_service(p_candidate,p_action,p_payload)$$;
create function public.system_activate_onboarding(p_token text) returns void language sql security invoker set search_path='' as $$select studio_access_private.system_activate_onboarding(p_token)$$;
create function public.system_onboarding_activation_ready(p_token text) returns boolean language sql security invoker set search_path='' as $$select studio_access_private.system_onboarding_activation_ready(p_token)$$;
create function public.system_my_pending_onboarding() returns boolean language sql security invoker set search_path='' as $$select studio_access_private.system_my_pending_onboarding()$$;

revoke all on function public.system_role_template(uuid,text,jsonb),public.system_apply_role_template(uuid,uuid),public.system_onboarding(uuid,text,jsonb),public.system_activate_onboarding(text),public.system_onboarding_activation_ready(text),public.system_my_pending_onboarding() from public,anon;
grant execute on function public.system_role_template(uuid,text,jsonb),public.system_apply_role_template(uuid,uuid),public.system_onboarding(uuid,text,jsonb),public.system_activate_onboarding(text),public.system_onboarding_activation_ready(text),public.system_my_pending_onboarding() to authenticated;
revoke all on function public.system_onboarding_service(uuid,text,jsonb) from public,anon,authenticated;
grant usage on schema studio_access_private to service_role;
grant execute on function public.system_onboarding_service(uuid,text,jsonb) to service_role;
