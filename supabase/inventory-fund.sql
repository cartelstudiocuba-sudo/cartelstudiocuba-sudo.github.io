-- CUP fund: append-only ledger, explicit opening, immutable weekly revisions.
create table public.inventory_fund_ledger (
 id uuid primary key, created_at timestamptz not null default now(), occurred_on date not null,
 kind text not null check(kind in ('opening','purchase','reimbursement','reversal','adjustment')),
 amount numeric not null check(amount > '-Infinity'::numeric and amount < 'Infinity'::numeric),
 currency text not null default 'CUP' check(currency='CUP'),
 movement_id uuid unique references public.inventory_movements(id),
 reimbursement_id uuid unique references public.inventory_cash_reimbursements(id),
 reverses_id uuid unique references public.inventory_fund_ledger(id),
 actor_id uuid not null references auth.users(id), actor_name text not null,
 reference text not null, payment_method text not null, reason text not null,
 request_payload jsonb not null
);
create unique index inventory_one_opening on public.inventory_fund_ledger(kind) where kind='opening';
alter table public.inventory_fund_ledger enable row level security;
create policy inventory_fund_read on public.inventory_fund_ledger for select to authenticated using ((select public.inventory_has_access('read')));
revoke all on public.inventory_fund_ledger from anon,authenticated;
grant select on public.inventory_fund_ledger to authenticated;
alter table public.inventory_cash_reimbursements add column payment_method text, add column request_payload jsonb;
create policy inventory_reimbursement_read on public.inventory_cash_reimbursements for select to authenticated using ((select public.inventory_has_access('read')));
create policy inventory_closure_read on public.inventory_weekly_closures for select to authenticated using ((select public.inventory_has_access('read')));
revoke insert,update,delete on public.inventory_cash_reimbursements, public.inventory_weekly_closures from authenticated,anon;
grant select on public.inventory_cash_reimbursements,public.inventory_weekly_closures to authenticated;
create table public.inventory_closure_events (
 id uuid primary key, closure_id uuid not null references public.inventory_weekly_closures(id),
 created_at timestamptz not null default now(), actor_id uuid not null references auth.users(id), actor_name text not null,
 action text not null check(action in ('draft','approve','reopen')), reason text not null,
 snapshot jsonb not null, request_payload jsonb not null
);
alter table public.inventory_closure_events enable row level security;
create policy inventory_closure_event_read on public.inventory_closure_events for select to authenticated using ((select public.inventory_has_access('read')));
revoke all on public.inventory_closure_events from authenticated,anon;
grant select on public.inventory_closure_events to authenticated;

create function studio_access_private.inventory_check_date(d date) returns void language plpgsql set search_path='' as $$
begin
 if d is null or d > (now() at time zone 'America/Havana')::date then raise exception 'Fecha no válida o futura'; end if;
 if exists(select 1 from public.inventory_weekly_closures where currency='CUP' and status='approved' and d<=week_end) then raise exception 'La fecha afecta un cierre aprobado. El propietario debe reabrir los cierres afectados antes de corregir.'; end if;
end $$;

-- This guarded trigger applies to RPC and direct inserts; invoker permissions/RLS remain active.
create function public.inventory_cup_guard() returns trigger language plpgsql set search_path='' as $$
declare c text; opening_date date;
begin
 perform pg_advisory_xact_lock(761820261018::bigint);
 select currency into strict c from public.inventory_products where id=new.product_id;
 if c<>'CUP' or (new.currency is not null and new.currency<>'CUP') then raise exception 'Por ahora solo se permiten operaciones en CUP'; end if;
 perform studio_access_private.inventory_check_date(new.occurred_on);
 select occurred_on into opening_date from public.inventory_fund_ledger where kind='opening';
 if new.kind='entry' and opening_date is null then raise exception 'Registre primero el saldo inicial real del fondo'; end if;
 if new.kind='entry' and new.occurred_on<(select max(occurred_on) from public.inventory_fund_ledger) then raise exception 'Una compra del fondo no puede preceder al último movimiento de caja'; end if;
 if opening_date is not null and new.occurred_on<opening_date then raise exception 'La operación precede al inicio del fondo'; end if;
 if new.kind='entry' and new.quantity*new.unit_cost>(select coalesce(sum(amount),0) from public.inventory_fund_ledger) then raise exception 'Saldo del fondo insuficiente'; end if;
 return new;
end $$;
create trigger a_inventory_cup_guard before insert on public.inventory_movements for each row execute function public.inventory_cup_guard();
-- Private trigger writes only the derived ledger row, never an arbitrary client amount.
create function studio_access_private.inventory_purchase_ledger() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.inventory_has_access('write') then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 if new.kind='entry' then
 insert into public.inventory_fund_ledger(id,occurred_on,kind,amount,movement_id,actor_id,actor_name,reference,payment_method,reason,request_payload)
 values(new.id,new.occurred_on,'purchase',-new.quantity*new.unit_cost,new.id,auth.uid(),studio_access_private.inventory_actor_name(),coalesce(nullif(new.notes,''),new.id::text),'Fondo de Insumos','Compra desde el fondo',coalesce(new.request_payload,'{}'));
 end if;
 return new;
end $$;
revoke all on function studio_access_private.inventory_purchase_ledger() from public,anon,authenticated;
create trigger z_inventory_purchase_ledger after insert on public.inventory_movements for each row execute function studio_access_private.inventory_purchase_ledger();

create function public.inventory_fund_can_approve() returns boolean language sql stable set search_path='' as $$ select coalesce(studio_access_private.is_owner(),false) $$;
revoke all on function public.inventory_fund_can_approve() from public,anon;
grant execute on function public.inventory_fund_can_approve() to authenticated;

create function studio_access_private.inventory_fund_record(request_id uuid,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare prev public.inventory_fund_ledger; e public.inventory_economic_movements; target public.inventory_fund_ledger;
 k text=payload->>'kind'; d date=(payload->>'occurred_on')::date; a numeric=nullif(payload->>'amount','')::numeric; paid numeric; od date;
begin
 if auth.uid() is null or not public.inventory_has_access('write') then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 if request_id is null or payload is null or payload->>'currency' is distinct from 'CUP' then raise exception 'Solicitud CUP no válida'; end if;
 perform pg_advisory_xact_lock(761820261018::bigint);
 select * into prev from public.inventory_fund_ledger where id=request_id;
 if found then
 if prev.actor_id<>auth.uid() or prev.request_payload<>payload then raise exception 'UUID reutilizado con otros datos o responsable'; end if; return request_id; end if;
 if exists(select 1 from public.inventory_movements where id=request_id) then raise exception 'UUID ya usado en inventario'; end if;
 perform studio_access_private.inventory_check_date(d);
 if nullif(trim(payload->>'reference'),'') is null or nullif(trim(payload->>'payment_method'),'') is null or nullif(trim(payload->>'reason'),'') is null then raise exception 'Complete referencia, medio de pago y motivo'; end if;
 select occurred_on into od from public.inventory_fund_ledger where kind='opening';
 if d<(select max(occurred_on) from public.inventory_fund_ledger) then raise exception 'La fecha de caja no puede preceder al último movimiento; registre la corrección en la fecha actual'; end if;
 if k='opening' then
 if od is not null then raise exception 'El fondo ya tiene saldo inicial'; end if;
 if a is null or a<0 or a>='Infinity'::numeric then raise exception 'Saldo inicial no válido'; end if;
 -- Opening is available cash AFTER historical purchases; no historical row is rewritten.
 if payload->>'baseline' is distinct from 'available_after_historical_purchases' then raise exception 'Confirme el criterio del saldo inicial'; end if;
 elsif od is null then raise exception 'Registre primero el saldo inicial';
 elsif d<od then raise exception 'La operación precede al inicio del fondo';
 end if;
 if k='reimbursement' then
 if a is null or a<=0 or a>='Infinity'::numeric then raise exception 'Importe no válido'; end if;
 select * into strict e from public.inventory_economic_movements where id=(payload->>'economic_movement_id')::uuid for update;
 if e.currency<>'CUP' then raise exception 'No se pueden mezclar monedas'; end if;
 if d<e.occurred_on then raise exception 'El reintegro precede al consumo'; end if;
 select coalesce(sum(l.amount),0) into paid from public.inventory_fund_ledger l left join public.inventory_fund_ledger original on original.id=l.reverses_id where l.reimbursement_id in(select id from public.inventory_cash_reimbursements where economic_movement_id=e.id) or original.reimbursement_id in(select id from public.inventory_cash_reimbursements where economic_movement_id=e.id);
 if a>e.quantity*e.unit_cost-paid then raise exception 'El reintegro supera el pendiente'; end if;
 if nullif(trim(payload->>'delivered_by'),'') is null or nullif(trim(payload->>'received_by'),'') is null then raise exception 'Indique quién entrega y quién recibe'; end if;
 insert into public.inventory_cash_reimbursements(id,received_on,economic_movement_id,amount,currency,delivered_by,received_by,receipt_reference,recorded_by,payment_method,request_payload)
 values(request_id,d,e.id,a,'CUP',payload->>'delivered_by',payload->>'received_by',payload->>'reference',auth.uid(),payload->>'payment_method',payload);
 elsif k='reversal' then
 if not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo el propietario puede corregir' using errcode='42501'; end if;
 select * into strict target from public.inventory_fund_ledger where id=(payload->>'reverses_id')::uuid;
 if target.kind not in ('reimbursement','adjustment') or d<target.occurred_on then raise exception 'Movimiento no reversible o fecha anterior'; end if;
 a=-target.amount;
 elsif k='adjustment' then
 if not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo el propietario puede ajustar' using errcode='42501'; end if;
 if a is null or a=0 or a<='-Infinity'::numeric or a>='Infinity'::numeric then raise exception 'Importe no válido'; end if;
 elsif k<>'opening' then raise exception 'Operación no válida'; end if;
 if a<0 and a+(select coalesce(sum(amount),0) from public.inventory_fund_ledger)<0 then raise exception 'Saldo insuficiente para corregir'; end if;
 insert into public.inventory_fund_ledger(id,occurred_on,kind,amount,reimbursement_id,reverses_id,actor_id,actor_name,reference,payment_method,reason,request_payload)
 values(request_id,d,k,a,case when k='reimbursement' then request_id end,case when k='reversal' then target.id end,auth.uid(),studio_access_private.inventory_actor_name(),payload->>'reference',payload->>'payment_method',payload->>'reason',payload);
 return request_id;
end $$;
revoke all on function studio_access_private.inventory_fund_record(uuid,jsonb) from public,anon;
grant execute on function studio_access_private.inventory_fund_record(uuid,jsonb) to authenticated;
create function public.inventory_fund_record(request_id uuid,payload jsonb) returns uuid language sql set search_path='' as $$ select studio_access_private.inventory_fund_record(request_id,payload) $$;
revoke all on function public.inventory_fund_record(uuid,jsonb) from public,anon;
grant execute on function public.inventory_fund_record(uuid,jsonb) to authenticated;

create function public.inventory_fund_report(start_date date,end_date date) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.inventory_has_access('read') then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 if start_date is null or end_date is null or end_date<>start_date+6 then raise exception 'Seleccione siete días consecutivos'; end if;
 select jsonb_build_object('start',start_date,'end',end_date,'currency','CUP',
 'opening_date',(select occurred_on from public.inventory_fund_ledger where kind='opening'),
 'balance_before',(select coalesce(sum(amount),0) from public.inventory_fund_ledger where occurred_on<start_date),
 'balance_end',(select coalesce(sum(amount),0) from public.inventory_fund_ledger where occurred_on<=end_date),
 'ledger',coalesce((select jsonb_agg(l order by occurred_on,id) from public.inventory_fund_ledger l where occurred_on between start_date and end_date),'[]'),
 'purchases',coalesce((select jsonb_agg(m order by m.occurred_on,m.id) from public.inventory_movements m join public.inventory_products p on p.id=m.product_id where m.kind='entry' and coalesce(m.currency,p.currency)='CUP' and m.occurred_on between start_date and end_date),'[]'),
 'consumption',coalesce((select jsonb_agg(e order by occurred_on,id) from public.inventory_economic_movements e where currency='CUP' and occurred_on between start_date and end_date),'[]'),
 'receivables',coalesce((select jsonb_agg(t order by occurred_on,id) from (
 select e.*, e.quantity*e.unit_cost-coalesce((select sum(l.amount) from public.inventory_fund_ledger l left join public.inventory_fund_ledger original on original.id=l.reverses_id where l.occurred_on<=end_date and (l.reimbursement_id in(select id from public.inventory_cash_reimbursements where economic_movement_id=e.id) or original.reimbursement_id in(select id from public.inventory_cash_reimbursements where economic_movement_id=e.id))),0) pending
 from public.inventory_economic_movements e where e.currency='CUP' and e.occurred_on<=end_date)t),'[]')) into result;
 return result;
end $$;
revoke all on function public.inventory_fund_report(date,date) from public,anon;
grant execute on function public.inventory_fund_report(date,date) to authenticated;

create function studio_access_private.inventory_close_week(request_id uuid,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare old_event public.inventory_closure_events; c public.inventory_weekly_closures; s date=(payload->>'start')::date; e date=(payload->>'end')::date; act text=payload->>'action'; snap jsonb;
begin
 if auth.uid() is null or not public.inventory_has_access('write') then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 if request_id is null or payload is null or payload->>'currency' is distinct from 'CUP' then raise exception 'Solicitud CUP no válida'; end if;
 perform pg_advisory_xact_lock(761820261018::bigint);
 select * into old_event from public.inventory_closure_events where id=request_id;
 if found then if old_event.actor_id<>auth.uid() or old_event.request_payload<>payload then raise exception 'UUID reutilizado'; end if; return old_event.closure_id; end if;
 if s is null or e is null or e<>s+6 or e>(now() at time zone 'America/Havana')::date then raise exception 'El cierre requiere siete días terminados'; end if;
 if not exists(select 1 from public.inventory_fund_ledger where kind='opening' and occurred_on<=e) then raise exception 'Registre primero el saldo inicial del fondo'; end if;
 if act not in ('draft','approve','reopen') or act is null then raise exception 'Acción no válida'; end if;
 if act in ('approve','reopen') and not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo el propietario aprueba o reabre' using errcode='42501'; end if;
 if nullif(trim(payload->>'reason'),'') is null then raise exception 'Indique el motivo'; end if;
 select * into c from public.inventory_weekly_closures where week_start=s and week_end=e and currency='CUP' for update;
 if c.id is null then
 if act<>'draft' then raise exception 'Guarde primero el borrador'; end if;
 if exists(select 1 from public.inventory_weekly_closures where currency='CUP' and daterange(week_start,week_end,'[]') && daterange(s,e,'[]')) then raise exception 'El período solapa otro cierre'; end if;
 insert into public.inventory_weekly_closures(week_start,week_end,currency) values(s,e,'CUP') returning * into c;
 end if;
 if c.status='approved' and act<>'reopen' then raise exception 'Reabra el cierre con un motivo'; end if;
 if act='reopen' and c.status<>'approved' then raise exception 'El cierre no está aprobado'; end if;
 snap=public.inventory_fund_report(s,e);
 if act='approve' then
 if payload->'snapshot' is distinct from snap then raise exception 'Los datos cambiaron: actualice la vista previa'; end if;
 if not exists(select 1 from public.inventory_closure_events where closure_id=c.id and action='draft' and snapshot=snap) then raise exception 'Actualice y guarde el borrador antes de aprobar'; end if;
 end if;
 update public.inventory_weekly_closures set status=case when act='approve' then 'approved' else 'draft' end,approved_at=case when act='approve' then now() end,approved_by=case when act='approve' then auth.uid() end where id=c.id;
 insert into public.inventory_closure_events(id,closure_id,actor_id,actor_name,action,reason,snapshot,request_payload) values(request_id,c.id,auth.uid(),studio_access_private.inventory_actor_name(),act,payload->>'reason',snap,payload);
 return c.id;
end $$;
revoke all on function studio_access_private.inventory_close_week(uuid,jsonb) from public,anon;
grant execute on function studio_access_private.inventory_close_week(uuid,jsonb) to authenticated;
create function public.inventory_close_week(request_id uuid,payload jsonb) returns uuid language sql set search_path='' as $$ select studio_access_private.inventory_close_week(request_id,payload) $$;
revoke all on function public.inventory_close_week(uuid,jsonb) from public,anon;
grant execute on function public.inventory_close_week(uuid,jsonb) to authenticated;
revoke all on function public.inventory_cup_guard() from public,anon,authenticated;
revoke all on function studio_access_private.inventory_check_date(date) from public,anon;
grant execute on function studio_access_private.inventory_check_date(date) to authenticated;
notify pgrst,'reload schema';
