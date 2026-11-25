create or replace function public.treasury_history_filtered(p_fund text, p_offset integer, p_month date, p_kind text, p_currency text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not studio_access_private.fridge_manager() then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('all','income','expense') or p_currency is null or p_currency not in ('all','CUP','USD') then raise exception 'Filtro inválido'; end if;
 return coalesce((select jsonb_agg(to_jsonb(t) order by occurred_on desc nulls last,created_at desc,id) from (
 select id,occurred_on,concept,area,amount,currency,source,created_at
 from studio_access_private.treasury_ledger
 where fund=p_fund
 and (p_month is null or (occurred_on>=date_trunc('month',p_month)::date and occurred_on<(date_trunc('month',p_month)+interval '1 month')::date))
 and (p_kind='all' or (p_kind='income' and amount>0) or (p_kind='expense' and amount<0))
 and (p_currency='all' or currency=p_currency)
 order by occurred_on desc nulls last,created_at desc,id limit 101 offset greatest(p_offset,0)
 ) t),'[]'::jsonb);
end $$;
revoke all on function public.treasury_history_filtered(text,integer,date,text,text) from public,anon;
grant execute on function public.treasury_history_filtered(text,integer,date,text,text) to authenticated;
