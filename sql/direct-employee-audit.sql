create function studio_access_private.audit_direct_employee_details() returns trigger language plpgsql security definer set search_path='' as $$
declare changed jsonb;
begin
 if new.data->>'record_source' is distinct from 'direct_existing_worker' then return new;end if;
 if tg_op='UPDATE' and new.data is not distinct from old.data then return new;end if;
 select jsonb_agg(k) into changed from jsonb_object_keys(new.data) k where tg_op='INSERT' or new.data->k is distinct from old.data->k;
 insert into studio_access_private.permission_audit(actor_id,kind,target,after_data) values(auth.uid(),case when tg_op='INSERT' then 'employee_personal_created' else 'employee_personal_updated' end,new.employee_id::text,jsonb_build_object('fields',coalesce(changed,'[]'),'record_source','direct_existing_worker'));
 return new;
end $$;
revoke all on function studio_access_private.audit_direct_employee_details() from public,anon,authenticated;
create trigger direct_employee_details_audit after insert or update on public.hr_employee_personal_details for each row execute function studio_access_private.audit_direct_employee_details();


