-- Accounts remain current until their fully paid operations enter a generated reconciliation.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
create function studio_access_private.fridge_account_settled(p_customer uuid) returns boolean language sql stable security definer set search_path='' as $$
 select p_customer is null or coalesce((select sum(amount) from studio_access_private.fridge_sales where customer_id=p_customer),0)<=coalesce((select sum(amount) from studio_access_private.fridge_payments where customer_id=p_customer),0)
$$;
revoke all on function studio_access_private.fridge_account_settled(uuid) from public,anon,authenticated;
-- Patch only the draft selector. Existing report snapshots and linked operations are immutable.
do $$declare r record;d text;needle text:='o.kind in (''sale'',''payment'') and';n integer:=0;begin
 for r in select oid from pg_proc where pronamespace='studio_access_private'::regnamespace and proname like 'fridge_reconciliation_snapshot%' loop
 d:=pg_get_functiondef(r.oid);
 if position('select array_agg(o.id order by o.created_at,o.id) into ids' in d)>0 and position(needle in d)>0 then
 d:=replace(d,needle,needle||' (p_report is not null or studio_access_private.fridge_account_settled(nullif(o.result->>''customer_id'','''')::uuid)) and');execute d;n:=n+1;
 end if;
 end loop;
 if n<>1 then raise exception 'Expected one core snapshot selector, found %',n;end if;
end $$;
create function studio_access_private.fridge_account_board() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if not studio_access_private.fridge_allowed() then raise exception 'No tienes acceso a Nevera audiovisual' using errcode='42501';end if;
 with balances as (
 select c.id,c.name,c.kind,coalesce((select sum(amount) from studio_access_private.fridge_sales where customer_id=c.id),0)-coalesce((select sum(amount) from studio_access_private.fridge_payments where customer_id=c.id),0) balance from studio_access_private.fridge_customers c
 ),ops as (
 select o.*,nullif(o.result->>'customer_id','')::uuid customer_id,ro.reconciliation_id from studio_access_private.fridge_operations o left join studio_access_private.fridge_reconciliation_ops ro on ro.operation_id=o.id where o.kind in ('sale','payment')
 ),groups as (
 select coalesce(o.customer_id,o.id) account_key,o.customer_id,o.reconciliation_id,max(o.created_at) latest_at,
 coalesce(max(c.name),max(o.result->'sale_context'->>'name'),max(o.result->>'customer_name'),'Venta') name,
 coalesce(max(c.kind),'client') kind,case when o.reconciliation_id is null then coalesce(max(c.balance),0) else 0 end balance,
 sum(case when o.kind='sale' then coalesce((o.result->>'amount')::numeric,0) else 0 end) amount,
 jsonb_agg(jsonb_build_object('id',o.id,'kind',o.kind,'created_at',o.created_at,'actor',o.actor_name,'details',o.result) order by o.created_at desc,o.id) operations
 from ops o left join balances c on c.id=o.customer_id group by coalesce(o.customer_id,o.id),o.customer_id,o.reconciliation_id
 ),entries as (
 select g.*,r.number report_number,r.status report_status from groups g left join studio_access_private.fridge_reconciliations r on r.id=g.reconciliation_id
 union all select c.id,c.id,null,c.created_at,c.name,c.kind,0,0,'[]'::jsonb,null,null from studio_access_private.fridge_customers c where not exists(select 1 from studio_access_private.fridge_sales s where s.customer_id=c.id)
 )select coalesce(jsonb_agg(to_jsonb(e) order by latest_at desc,account_key),'[]') into result from entries e;
 return jsonb_build_object('accounts',result,'as_of',now());
end $$;
revoke all on function studio_access_private.fridge_account_board() from public,anon;
grant execute on function studio_access_private.fridge_account_board() to authenticated;
create function public.fridge_account_board() returns jsonb language sql stable security invoker set search_path='' as $$select studio_access_private.fridge_account_board()$$;
revoke all on function public.fridge_account_board() from public,anon;
grant execute on function public.fridge_account_board() to authenticated;
