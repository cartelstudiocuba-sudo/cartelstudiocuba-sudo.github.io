create or replace function public.treasury_fund_summary(p_fund text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not studio_access_private.fridge_manager() then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 return jsonb_build_object('first_date',(select min(occurred_on) from studio_access_private.treasury_ledger where fund=p_fund),'areas',(select coalesce(jsonb_agg(a order by a),'[]'::jsonb) from (select distinct area as a from studio_access_private.treasury_ledger where fund=p_fund and area is not null and btrim(area)<>'') x),'months',coalesce((select jsonb_agg(to_jsonb(t) order by month,currency) from (
 select date_trunc('month',occurred_on)::date as month,currency,sum(greatest(amount,0)) as income,sum(greatest(-amount,0)) as expense
 from studio_access_private.treasury_ledger where fund=p_fund and occurred_on is not null
 group by 1,2
 ) t),'[]'::jsonb),'undated',(select count(*) from studio_access_private.treasury_ledger where fund=p_fund and occurred_on is null));
end $$;
revoke all on function public.treasury_fund_summary(text) from public,anon;
grant execute on function public.treasury_fund_summary(text) to authenticated;
create or replace function public.treasury_history_search(p_fund text, p_offset integer, p_month date, p_kind text, p_currency text, p_search text, p_area text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not studio_access_private.fridge_manager() then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('all','income','expense') or p_currency is null or p_currency not in ('all','CUP','USD') then raise exception 'Filtro inválido'; end if;
 return coalesce((select jsonb_agg(to_jsonb(t) order by occurred_on desc nulls last,created_at desc,id) from (
 select id,occurred_on,concept,area,amount,currency,source,created_at,metadata->'registration'->>'category' as category,metadata->'registration'->>'rate' as declared_rate,exists(select 1 from studio_access_private.treasury_receipts r where r.movement_id=treasury_ledger.id) as has_receipt
 from studio_access_private.treasury_ledger
 where fund=p_fund
 and (coalesce(p_search,'')='' or strpos(lower(concept),lower(p_search))>0)
 and (coalesce(p_area,'')='' or upper(coalesce(area,''))=upper(p_area))
 and (p_month is null or (occurred_on>=date_trunc('month',p_month)::date and occurred_on<(date_trunc('month',p_month)+interval '1 month')::date))
 and (p_kind='all' or (p_kind='income' and amount>0) or (p_kind='expense' and amount<0))
 and (p_currency='all' or currency=p_currency)
 order by occurred_on desc nulls last,created_at desc,id limit 101 offset greatest(p_offset,0)
 ) t),'[]'::jsonb);
end $$;
revoke all on function public.treasury_history_search(text,integer,date,text,text,text,text) from public,anon;
grant execute on function public.treasury_history_search(text,integer,date,text,text,text,text) to authenticated;
