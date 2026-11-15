-- Return to legacy checkout writes; reject stale new forms instead of losing their metadata.
-- Keep additive columns, manual staff identities and the courtesy report read extension.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
create or replace function studio_access_private.fridge_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not studio_access_private.fridge_allowed() then raise exception 'No tienes acceso a Nevera audiovisual' using errcode='42501';end if;
 if p_payload ? 'sale_context' or p_payload ? 'collection' then raise exception 'Actualiza la pantalla de ventas antes de continuar';end if;
 return studio_access_private.fridge_command_before_checkout(p_id,p_kind,p_payload);
end $$;
revoke all on function studio_access_private.fridge_command(uuid,text,jsonb) from public,anon;
grant execute on function studio_access_private.fridge_command(uuid,text,jsonb) to authenticated;
