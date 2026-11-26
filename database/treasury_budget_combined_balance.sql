create or replace function public.treasury_approve_budget(p_id uuid,p_fund text,p_currency text,p_rate numeric,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare r public.purchase_budget_requests%rowtype; a numeric; t jsonb; available_cup numeric; required_cup numeric;
begin
 if not coalesce((public.purchase_budget_capabilities()->>'manager')::boolean,false) then raise exception 'Solo Manager General';end if;
 if p_currency not in ('CUP','USD') or p_rate is null or p_rate<=0 or p_rate>1000000 or p_fund='workers' then raise exception 'Selecciona fondo, moneda y tasa';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.treasury',0));
 select * into strict r from public.purchase_budget_requests where id=p_id for update;
 if exists(select 1 from studio_access_private.treasury_reservations where request_id=p_id) then if exists(select 1 from studio_access_private.treasury_reservations where request_id=p_id and fund=p_fund and currency=p_currency and rate=p_rate and actor=auth.uid()) then return;end if;raise exception 'La solicitud ya tiene una reserva';end if;
 t:=coalesce(r.totals,jsonb_build_object(r.currency,r.amount));
 a:=round(case when p_currency='CUP' then coalesce((t->>'CUP')::numeric,0)+coalesce((t->>'USD')::numeric,0)*p_rate else coalesce((t->>'USD')::numeric,0)+coalesce((t->>'CUP')::numeric,0)/p_rate end,2);
 available_cup:=studio_access_private.treasury_available(p_fund,'CUP')+studio_access_private.treasury_available(p_fund,'USD')*p_rate;
 required_cup:=a*case when p_currency='USD' then p_rate else 1 end;
 if a<=0 or (p_fund<>'investment' and available_cup<required_cup) then raise exception 'Saldo disponible total insuficiente';end if;
 insert into studio_access_private.treasury_reservations(request_id,fund,currency,amount,rate,actor) values(p_id,p_fund,p_currency,a,p_rate,auth.uid());
 perform public.purchase_budget_decide(p_id,'manager_pending',true,p_note);
end $$;
