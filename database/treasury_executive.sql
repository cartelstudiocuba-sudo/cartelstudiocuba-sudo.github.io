create or replace function public.treasury_monthly(p_month date, p_workers boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not studio_access_private.fridge_manager() then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(t) order by day,currency) from (
 select l.occurred_on as day,l.currency,sum(greatest(l.amount,0)) as income,sum(greatest(-l.amount,0)) as expense
 from studio_access_private.treasury_ledger l join studio_access_private.treasury_funds f on f.code=l.fund
 where f.worker=p_workers and l.source<>'transfer' and l.occurred_on>=date_trunc('month',p_month)::date
 and l.occurred_on<(date_trunc('month',p_month)+interval '1 month')::date
 group by l.occurred_on,l.currency) t),'[]'::jsonb);
end $$;
create or replace function public.treasury_transfer(p_id uuid,p_from text,p_to text,p_currency text,p_amount numeric,p_concept text)
returns void language plpgsql security definer set search_path='' as $$
declare from_label text; to_label text;
begin
 if not studio_access_private.fridge_manager() then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 if p_id is null or p_from is null or p_to is null or p_from=p_to or p_currency is null or p_currency not in ('CUP','USD') or p_amount is null or p_amount<=0 or p_amount>999999999999 or p_amount<>round(p_amount,2) or length(btrim(coalesce(p_concept,''))) not between 1 and 500 then raise exception 'Traspaso inválido'; end if;
 select label into from_label from studio_access_private.treasury_funds where code=p_from and not worker;
 select label into to_label from studio_access_private.treasury_funds where code=p_to and not worker;
 if from_label is null or to_label is null then raise exception 'Fondo inválido'; end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.treasury',0));
 if exists(select 1 from studio_access_private.treasury_ledger where source_key='transfer:'||p_id||':out') then
 if exists(select 1 from studio_access_private.treasury_ledger where source_key='transfer:'||p_id||':out' and fund=p_from and currency=p_currency and amount=-p_amount and actor=auth.uid() and metadata->>'destination'=p_to and metadata->>'reason'=btrim(p_concept)) then return; end if;
 raise exception 'Identificador ya utilizado'; end if;
 if studio_access_private.treasury_available(p_from,p_currency)<p_amount then raise exception 'Saldo disponible insuficiente'; end if;
 insert into studio_access_private.treasury_ledger(fund,currency,amount,occurred_on,concept,source,source_key,actor,metadata) values
 (p_from,p_currency,-p_amount,(now() at time zone 'America/Havana')::date,'Traspaso a '||to_label||' · '||btrim(p_concept),'transfer','transfer:'||p_id||':out',auth.uid(),jsonb_build_object('destination',p_to,'reason',btrim(p_concept))),
 (p_to,p_currency,p_amount,(now() at time zone 'America/Havana')::date,'Traspaso desde '||from_label||' · '||btrim(p_concept),'transfer','transfer:'||p_id||':in',auth.uid(),jsonb_build_object('origin',p_from,'reason',btrim(p_concept)));
end $$;
revoke all on function public.treasury_monthly(date,boolean),public.treasury_transfer(uuid,text,text,text,numeric,text) from public,anon;
grant execute on function public.treasury_monthly(date,boolean),public.treasury_transfer(uuid,text,text,text,numeric,text) to authenticated;
