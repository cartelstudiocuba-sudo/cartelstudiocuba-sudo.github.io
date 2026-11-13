create table public.inventory_order_reads (
 user_id uuid not null references auth.users(id) on delete cascade,
 order_id uuid not null references public.inventory_orders(id) on delete cascade,
 seen_at timestamptz not null default now(),
 primary key(user_id,order_id)
);
alter table public.inventory_order_reads enable row level security;
revoke all on public.inventory_order_reads from anon,authenticated;
grant select,insert on public.inventory_order_reads to authenticated;
create policy order_reads_select on public.inventory_order_reads for select to authenticated using(user_id=(select auth.uid()));
create policy order_reads_insert on public.inventory_order_reads for insert to authenticated with check (
 user_id=(select auth.uid()) and (public.inventory_order_capabilities()->>'approve')::boolean
 and exists(select 1 from public.inventory_orders o where o.id=order_id and o.status='pending')
);
create function public.inventory_order_notifications(p_seen uuid[] default '{}'::uuid[]) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Autenticación requerida' using errcode='42501'; end if;
 if not coalesce((public.inventory_order_capabilities()->>'approve')::boolean,false) then
  return jsonb_build_object('pending',0,'unseen',0);
 end if;
 if cardinality(p_seen)>500 then raise exception 'Demasiadas solicitudes'; end if;
 insert into public.inventory_order_reads(user_id,order_id)
 select auth.uid(),o.id from public.inventory_orders o where o.status='pending' and o.id=any(p_seen)
 on conflict do nothing;
 select jsonb_build_object('pending',count(*),'unseen',count(*) filter(where r.order_id is null))
 into result from public.inventory_orders o left join public.inventory_order_reads r
 on r.order_id=o.id and r.user_id=auth.uid() where o.status='pending';
 return result;
end $$;
revoke all on function public.inventory_order_notifications(uuid[]) from public,anon;
grant execute on function public.inventory_order_notifications(uuid[]) to authenticated;
