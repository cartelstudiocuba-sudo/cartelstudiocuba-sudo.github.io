-- Preserve all Step 13 gates; attach optional equipment condition to its existing receipt operation.
create function studio_offboarding_private.manage_with_asset_condition(p_employee uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;asset public.hr_employee_assets%rowtype;condition text;
begin
 result:=studio_offboarding_private.manage(p_employee,p_action,p_payload);
 if p_action='receipt' and p_payload->>'state'='received' then
  condition:=nullif(btrim(p_payload->>'physical_condition'),'');
  update public.hr_employee_assets set returned_by=auth.uid(),returned_condition=coalesce(condition,returned_condition) where id=(p_payload->>'asset_id')::uuid and employee_id=p_employee returning * into asset;
  if asset.catalog_id is not null and condition is not null then update public.studio_assets set physical_condition=left(condition,500),revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=asset.catalog_id;end if;
 end if;
 if jsonb_typeof(result->'assets')='array' then
  result:=jsonb_set(result,'{assets}',coalesce((select jsonb_agg(x||jsonb_build_object('asset_code',a.asset_code,'assigned_condition',a.assigned_condition,'returned_condition',a.returned_condition,'returned_by',a.returned_by)) from jsonb_array_elements(result->'assets') x join public.hr_employee_assets a on a.id=(x->>'asset_id')::uuid),'[]'));
 end if;
 return result;
end $$;
revoke all on function studio_offboarding_private.manage_with_asset_condition(uuid,text,jsonb) from public,anon;
grant execute on function studio_offboarding_private.manage_with_asset_condition(uuid,text,jsonb) to authenticated;
create or replace function public.hr_offboarding(p_employee uuid,p_action text default 'read',p_payload jsonb default '{}') returns jsonb language sql set search_path='' as $$select studio_offboarding_private.manage_with_asset_condition(p_employee,p_action,p_payload)$$;
