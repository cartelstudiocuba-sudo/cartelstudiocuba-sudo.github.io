create or replace function public.treasury_activity(p_offset integer,p_limit integer,p_fund text,p_kind text,p_currency text,p_month date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not studio_access_private.fridge_manager() then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 if p_kind is null or p_kind not in ('all','income','expense','transfer') or p_currency is null or p_currency not in ('all','CUP','USD') then raise exception 'Filtro inválido';end if;
 return coalesce((select jsonb_agg(to_jsonb(t) order by activity_at desc nulls last,created_at desc,id) from (
 select l.id,l.fund,f.label as fund_label,l.occurred_on,l.concept,l.area,l.amount,l.currency,l.source,l.created_at,
 case when l.source='excel' then l.occurred_on::timestamp at time zone 'America/Havana' else l.created_at end as activity_at,
 case when l.source='excel' then null else coalesce(
 (select nullif(btrim(e.full_name),'') from public.hr_employees e where e.system_auth_user_id=l.actor order by e.full_name limit 1),
 (select left(nullif(btrim(u.raw_user_meta_data->>'username'),''),80) from auth.users u where u.id=l.actor)
 ) end as actor_name
 from studio_access_private.treasury_ledger l join studio_access_private.treasury_funds f on f.code=l.fund
 where (p_fund is null or l.fund=p_fund)
 and (p_kind='all' or (p_kind='transfer' and l.source='transfer') or (p_kind='income' and l.amount>0 and l.source<>'transfer') or (p_kind='expense' and l.amount<0 and l.source<>'transfer'))
 and (p_currency='all' or l.currency=p_currency)
 and (p_month is null or (l.occurred_on>=date_trunc('month',p_month)::date and l.occurred_on<(date_trunc('month',p_month)+interval '1 month')::date))
 order by activity_at desc nulls last,l.created_at desc,l.id limit least(greatest(coalesce(p_limit,11),1),101) offset greatest(coalesce(p_offset,0),0)
 ) t),'[]'::jsonb);
end $$;
revoke all on function public.treasury_activity(integer,integer,text,text,text,date) from public,anon;
grant execute on function public.treasury_activity(integer,integer,text,text,text,date) to authenticated;
