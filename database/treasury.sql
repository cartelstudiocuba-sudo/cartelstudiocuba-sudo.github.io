-- Monetary balances are derived from append-only movements; historical CUP equivalents are provisional.
create table studio_access_private.treasury_funds(code text primary key, label text not null, worker boolean not null default false);
insert into studio_access_private.treasury_funds values
 ('fixed','Gastos fijos',false),('investment','Inversiones',false),('supplies','Insumos',false),('stimulus','Estímulo',false),('profit','Utilidad',false),('surplus','Remanentes',false),('workers','Pagos a trabajadores',true);
create table studio_access_private.treasury_ledger(
 id uuid primary key default gen_random_uuid(), fund text not null references studio_access_private.treasury_funds(code),
 currency text not null check(currency in ('CUP','USD')), amount numeric(18,2) not null,
 occurred_on date, concept text not null, area text, source text not null, source_key text not null unique,
 actor uuid, created_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb, check(amount<>0 or source='excel')
);
create index treasury_ledger_fund_date on studio_access_private.treasury_ledger(fund,occurred_on desc,created_at desc,id);
create table studio_access_private.treasury_reservations(
 request_id uuid primary key references public.purchase_budget_requests(id), fund text not null references studio_access_private.treasury_funds(code),
 currency text not null check(currency in ('CUP','USD')), amount numeric(18,2) not null check(amount>0), rate numeric not null check(rate>0),
 status text not null default 'reserved' check(status in ('reserved','delivered')), actor uuid not null, created_at timestamptz not null default now(),
 delivered_at timestamptz, delivered_by uuid, evidence jsonb
);
create table studio_access_private.treasury_ceo_dispatch(
 id uuid primary key, cup numeric(18,2) not null check(cup>=0), usd numeric(18,2) not null check(usd>=0), note text not null,
 status text not null default 'pending' check(status in ('pending','confirmed')), created_by uuid not null, created_at timestamptz not null default now(), confirmed_by uuid,confirmed_at timestamptz
);
alter table studio_access_private.treasury_funds enable row level security;
alter table studio_access_private.treasury_ledger enable row level security;
alter table studio_access_private.treasury_reservations enable row level security;
alter table studio_access_private.treasury_ceo_dispatch enable row level security;
revoke all on studio_access_private.treasury_funds,studio_access_private.treasury_ledger,studio_access_private.treasury_reservations,studio_access_private.treasury_ceo_dispatch from public,anon,authenticated;
create function studio_access_private.treasury_available(p_fund text,p_currency text) returns numeric language sql stable set search_path='' as $$
 select coalesce((select sum(amount) from studio_access_private.treasury_ledger where fund=p_fund and currency=p_currency),0)
 -coalesce((select sum(amount) from studio_access_private.treasury_reservations where fund=p_fund and currency=p_currency and status='reserved'),0)
 -case when p_fund='profit' then coalesce((select sum(case when p_currency='CUP' then cup else usd end) from studio_access_private.treasury_ceo_dispatch where status='pending'),0) else 0 end
$$;
create function public.treasury_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not studio_access_private.fridge_manager() then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 return jsonb_build_object('owner',studio_access_private.is_owner(),'funds',(select jsonb_agg(jsonb_build_object('code',f.code,'label',f.label,'worker',f.worker,'CUP',coalesce((select sum(amount) from studio_access_private.treasury_ledger where fund=f.code and currency='CUP'),0),'USD',coalesce((select sum(amount) from studio_access_private.treasury_ledger where fund=f.code and currency='USD'),0),'available_CUP',studio_access_private.treasury_available(f.code,'CUP'),'available_USD',studio_access_private.treasury_available(f.code,'USD')) order by f.worker,f.code) from studio_access_private.treasury_funds f),'dispatches',coalesce((select jsonb_agg(to_jsonb(d) order by created_at desc) from studio_access_private.treasury_ceo_dispatch d),'[]'));
end $$;
create function public.treasury_history(p_fund text,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not studio_access_private.fridge_manager() then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(t)) from (select * from studio_access_private.treasury_ledger where fund=p_fund order by occurred_on desc nulls last,created_at desc,id limit 100 offset greatest(p_offset,0)) t),'[]');
end $$;
create function public.treasury_move(p_id uuid,p_fund text,p_currency text,p_amount numeric,p_concept text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not studio_access_private.fridge_manager() then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 if p_id is null or p_currency not in ('CUP','USD') or p_amount is null or p_amount=0 or abs(p_amount)>999999999999 or p_amount<>round(p_amount,2) or length(btrim(coalesce(p_concept,''))) not between 1 and 500 then raise exception 'Movimiento inválido';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.treasury',0));
 if exists(select 1 from studio_access_private.treasury_ledger where source_key='manual:'||p_id) then
 if exists(select 1 from studio_access_private.treasury_ledger where source_key='manual:'||p_id and fund=p_fund and currency=p_currency and amount=p_amount and concept=btrim(p_concept) and actor=auth.uid()) then return;end if;raise exception 'Identificador ya utilizado';end if;
 if p_amount<0 and studio_access_private.treasury_available(p_fund,p_currency)<-p_amount and p_fund<>'investment' then raise exception 'Saldo disponible insuficiente';end if;
 if p_amount<0 and p_fund='investment' and exists(select 1 from studio_access_private.treasury_reservations where fund=p_fund and currency=p_currency and status='reserved') and studio_access_private.treasury_available(p_fund,p_currency)<-p_amount then raise exception 'Hay presupuesto reservado';end if;
 insert into studio_access_private.treasury_ledger(fund,currency,amount,occurred_on,concept,source,source_key,actor) values(p_fund,p_currency,p_amount,(now() at time zone 'America/Havana')::date,btrim(p_concept),'manual','manual:'||p_id,auth.uid());
end $$;
create function public.treasury_dispatch(p_id uuid,p_cup numeric,p_usd numeric,p_note text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not studio_access_private.fridge_manager() then raise exception 'Acceso no autorizado';end if;
 if p_id is null or p_cup is null or p_usd is null or p_cup<0 or p_usd<0 or p_cup+p_usd<=0 or p_cup<>round(p_cup,2) or p_usd<>round(p_usd,2) then raise exception 'Importes inválidos';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.treasury',0));
 if exists(select 1 from studio_access_private.treasury_ceo_dispatch where id=p_id) then if exists(select 1 from studio_access_private.treasury_ceo_dispatch where id=p_id and cup=p_cup and usd=p_usd and note=coalesce(p_note,'') and created_by=auth.uid()) then return;end if;raise exception 'Identificador ya utilizado';end if;
 if p_cup>studio_access_private.treasury_available('profit','CUP') or p_usd>studio_access_private.treasury_available('profit','USD') then raise exception 'Saldo insuficiente';end if;
 insert into studio_access_private.treasury_ceo_dispatch(id,cup,usd,note,created_by) values(p_id,p_cup,p_usd,coalesce(p_note,''),auth.uid());
end $$;
create function public.treasury_confirm_dispatch(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d studio_access_private.treasury_ceo_dispatch%rowtype;
begin
 if not studio_access_private.is_owner() then raise exception 'Solo el CEO confirma el recibido';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.treasury',0));
 select * into strict d from studio_access_private.treasury_ceo_dispatch where id=p_id for update;
 if d.status='confirmed' then return;end if;
 if d.created_by=auth.uid() then raise exception 'La entrega debe confirmarla otra persona';end if;
 insert into studio_access_private.treasury_ledger(fund,currency,amount,occurred_on,concept,source,source_key,actor)
 select 'profit',c,-a,(now() at time zone 'America/Havana')::date,'Entrega de utilidad al CEO','ceo_dispatch','dispatch:'||p_id||':'||c,auth.uid() from (values('CUP',d.cup),('USD',d.usd)) t(c,a) where a>0;
 update studio_access_private.treasury_ceo_dispatch set status='confirmed',confirmed_at=now(),confirmed_by=auth.uid() where id=p_id;
end $$;
-- A final approval must attach a real monetary reservation.
create function public.treasury_approve_budget(p_id uuid,p_fund text,p_currency text,p_rate numeric,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare r public.purchase_budget_requests%rowtype; a numeric; t jsonb;
begin
 if not coalesce((public.purchase_budget_capabilities()->>'manager')::boolean,false) then raise exception 'Solo Manager General';end if;
 if p_currency not in ('CUP','USD') or p_rate is null or p_rate<=0 or p_rate>1000000 or p_fund='workers' then raise exception 'Selecciona fondo, moneda y tasa';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.treasury',0));
 select * into strict r from public.purchase_budget_requests where id=p_id for update;
 if exists(select 1 from studio_access_private.treasury_reservations where request_id=p_id) then if exists(select 1 from studio_access_private.treasury_reservations where request_id=p_id and fund=p_fund and currency=p_currency and rate=p_rate and actor=auth.uid()) then return;end if;raise exception 'La solicitud ya tiene una reserva';end if;
 t:=coalesce(r.totals,jsonb_build_object(r.currency,r.amount));
 a:=round(case when p_currency='CUP' then coalesce((t->>'CUP')::numeric,0)+coalesce((t->>'USD')::numeric,0)*p_rate else coalesce((t->>'USD')::numeric,0)+coalesce((t->>'CUP')::numeric,0)/p_rate end,2);
 if a<=0 or studio_access_private.treasury_available(p_fund,p_currency)<a then raise exception 'Saldo disponible insuficiente en la moneda seleccionada';end if;
 insert into studio_access_private.treasury_reservations(request_id,fund,currency,amount,rate,actor) values(p_id,p_fund,p_currency,a,p_rate,auth.uid());
 perform public.purchase_budget_decide(p_id,'manager_pending',true,p_note);
end $$;
create function public.treasury_budget_reservation(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.purchase_budget_requests%rowtype;
begin
 select * into r from public.purchase_budget_requests where id=p_id;
 if not found or not (studio_access_private.fridge_manager() or r.requester=auth.uid()) then return null;end if;
 return (select to_jsonb(t)-'evidence'||jsonb_build_object('evidence',t.evidence is not null) from studio_access_private.treasury_reservations t where request_id=p_id);
end $$;
create function public.treasury_deliver_budget(p_id uuid,p_signature text,p_photo text) returns void language plpgsql security definer set search_path='' as $$
declare t studio_access_private.treasury_reservations%rowtype; r public.purchase_budget_requests%rowtype;
begin
 select * into strict r from public.purchase_budget_requests where id=p_id;
 if r.requester<>auth.uid() or auth.uid() is null then raise exception 'Solo el solicitante puede confirmar el recibido';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.treasury',0));
 select * into strict t from studio_access_private.treasury_reservations where request_id=p_id for update;
 if t.status='delivered' then return;end if;
 if r.status<>'approved' or p_signature is null or p_photo is null or p_signature not like 'data:image/png;base64,%' or p_photo not like 'data:image/jpeg;base64,%' or length(p_signature)>1000000 or length(p_photo)>2000000 or length(p_signature)<200 or length(p_photo)<200 then raise exception 'Firma y fotografía requeridas';end if;
 insert into studio_access_private.treasury_ledger(fund,currency,amount,occurred_on,concept,area,source,source_key,actor) values(t.fund,t.currency,-t.amount,(now() at time zone 'America/Havana')::date,r.product,r.area,'budget','budget:'||p_id,auth.uid());
 update studio_access_private.treasury_reservations set status='delivered',delivered_at=now(),delivered_by=auth.uid(),evidence=jsonb_build_object('signature',p_signature,'photo',p_photo) where request_id=p_id;
end $$;
-- Enforce the reservation even if an older client calls the original approval RPC.
create function studio_access_private.treasury_budget_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status='manager_pending' and new.status='approved' and not exists(select 1 from studio_access_private.treasury_reservations where request_id=new.id) then raise exception 'Selecciona el fondo y la moneda antes de aprobar';end if;return new;
end $$;
create trigger treasury_budget_guard before update of status on public.purchase_budget_requests for each row execute function studio_access_private.treasury_budget_guard();
-- Receipt settlement is persisted after approval; allocate actual received currencies by the approved distribution weights.
create function studio_access_private.treasury_bar_post() returns trigger language plpgsql security definer set search_path='' as $$
declare t jsonb; c record; total numeric; actual numeric;
begin
 if new.status<>'confirmed' or new.receipt_settlement is null or new.distribution is null then return new;end if;
 if exists(select 1 from studio_access_private.treasury_ledger where source='bar' and metadata->>'report_id'=new.id::text) then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.treasury',0));
 select sum((x->>'amount')::numeric) into total from jsonb_array_elements(new.distribution) x;
 if total is null or total<=0 then raise exception 'Reparto de nevera sin importe válido';end if;
 for c in select currency,sum(amount) amount from (
 select x->>'currency' currency,(x->>'amount')::numeric amount from jsonb_array_elements(new.receipt_settlement->'received_by_currency') x
 union all select x->>'currency',(x->>'amount')::numeric from jsonb_array_elements(studio_access_private.fridge_original_receipts(new.snapshot)) x where x->>'method'='transfer') q group by currency loop
 if c.currency not in ('CUP','USD') or c.amount<0 then raise exception 'Moneda de recibido inválida';end if;
 insert into studio_access_private.treasury_ledger(fund,currency,amount,occurred_on,concept,source,source_key,actor,metadata)
 select fund,c.currency,allocated,(new.confirmed_at at time zone 'America/Havana')::date,'Cuadre #'||new.number||' · '||name,'bar','bar:'||new.id||':'||c.currency||':'||ord,new.confirmed_by,jsonb_build_object('report_id',new.id,'distribution_key',key,'basis_usd',weight,'receipt_currency',c.currency)
 from (select *,round(c.amount*running/total,2)-round(c.amount*(running-weight)/total,2) allocated from (
 select ord,x->>'name' name,x->>'key' key,(x->>'amount')::numeric weight,
 sum((x->>'amount')::numeric) over(order by ord) running,
 case when x->>'kind'='reserve' then 'supplies' when x->>'kind'='commission' then 'workers' when x->>'key'='company-surplus' or x->>'basis'='residual' then 'surplus' when x->>'kind'='company' then 'profit' when lower(x->>'name')='recuperación' then 'investment' when lower(x->>'name')='gastos fijos' then 'fixed' else null end fund
 from jsonb_array_elements(new.distribution) with ordinality t(x,ord)) q) a where allocated>0;
 end loop;
 return new;
end $$;
create trigger treasury_bar_post after update of status,receipt_settlement on studio_access_private.fridge_reconciliations for each row execute function studio_access_private.treasury_bar_post();
revoke all on function public.treasury_state(),public.treasury_history(text,integer),public.treasury_move(uuid,text,text,numeric,text),public.treasury_dispatch(uuid,numeric,numeric,text),public.treasury_confirm_dispatch(uuid),public.treasury_approve_budget(uuid,text,text,numeric,text),public.treasury_budget_reservation(uuid),public.treasury_deliver_budget(uuid,text,text) from public,anon;
grant execute on function public.treasury_state(),public.treasury_history(text,integer),public.treasury_move(uuid,text,text,numeric,text),public.treasury_dispatch(uuid,numeric,numeric,text),public.treasury_confirm_dispatch(uuid),public.treasury_approve_budget(uuid,text,text,numeric,text),public.treasury_budget_reservation(uuid),public.treasury_deliver_budget(uuid,text,text) to authenticated;
revoke all on function studio_access_private.treasury_available(text,text),studio_access_private.treasury_budget_guard(),studio_access_private.treasury_bar_post() from public,anon,authenticated;
