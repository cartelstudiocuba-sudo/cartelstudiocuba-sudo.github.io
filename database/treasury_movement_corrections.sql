-- Corrections to independent ledger entries, with an immutable private audit trail.
create table if not exists studio_access_private.treasury_movement_corrections (
 operation_id uuid primary key,
 movement_id uuid not null,
 actor uuid not null,
 corrected_at timestamptz not null default now(),
 request jsonb not null,
 previous_entry jsonb not null,
 resulting_entry jsonb,
 deleted_receipt jsonb
);
alter table studio_access_private.treasury_movement_corrections enable row level security;
revoke all on studio_access_private.treasury_movement_corrections from public,anon,authenticated;

create or replace function public.treasury_correct_movement(
 p_operation uuid,p_id uuid,p_expected jsonb,p_delete boolean,
 p_concept text,p_date date,p_area text,p_currency text,p_amount numeric,p_rate numeric
) returns void language plpgsql security definer set search_path='' as $$
declare
 entry studio_access_private.treasury_ledger%rowtype;
 result studio_access_private.treasury_ledger%rowtype;
 prior studio_access_private.treasury_movement_corrections%rowtype;
 request_data jsonb;
 receipt_data jsonb;
 current_available numeric;
 change_amount numeric;
 c text;
begin
 if auth.uid() is null or not studio_access_private.fridge_manager() then
  raise exception 'Acceso no autorizado' using errcode='42501';
 end if;
 if p_operation is null or p_id is null or p_expected is null or p_delete is null then
  raise exception 'Datos de corrección inválidos';
 end if;
 request_data:=jsonb_build_object('id',p_id,'expected',p_expected,'delete',p_delete,'concept',p_concept,'date',p_date,'area',p_area,'currency',p_currency,'amount',p_amount,'rate',p_rate);
 perform pg_advisory_xact_lock(hashtextextended('cartel.treasury',0));
 select * into prior from studio_access_private.treasury_movement_corrections where operation_id=p_operation;
 if found then
  if prior.actor=auth.uid() and prior.request=request_data then return; end if;
  raise exception 'Identificador de corrección ya utilizado';
 end if;
 select * into entry from studio_access_private.treasury_ledger where id=p_id for update;
 if not found then raise exception 'El movimiento ya no está disponible'; end if;
 if entry.source not in ('manual','excel') then
  raise exception 'Este movimiento está vinculado a otra operación y debe corregirse desde su origen';
 end if;
 if jsonb_build_object('concept',entry.concept,'date',entry.occurred_on,'area',entry.area,'currency',entry.currency,'amount',entry.amount,'rate',entry.metadata->'registration'->>'rate') is distinct from p_expected then
  raise exception 'El movimiento cambió. Actualiza el historial antes de corregirlo';
 end if;
 if not p_delete then
  if length(btrim(coalesce(p_concept,''))) not between 1 and 500
   or p_currency is null or p_currency not in ('CUP','USD')
   or p_amount is null or abs(p_amount)>999999999999 or p_amount<>round(p_amount,2)
   or (p_amount=0 and entry.source<>'excel')
   or (p_rate is not null and (p_rate<=0 or p_rate>1000000))
   or (p_area is distinct from entry.area and coalesce(p_area,'') not in ('AUDIOVISUALES','GRAFICA','GENERAL'))
   or (p_date is null and entry.occurred_on is not null)
  then raise exception 'Datos del movimiento inválidos'; end if;
 end if;
 -- Preserve existing reservations and avoid worsening an insufficient balance.
 foreach c in array array['CUP','USD'] loop
  change_amount:=case when not p_delete and p_currency=c then p_amount else 0 end
   -case when entry.currency=c then entry.amount else 0 end;
  current_available:=studio_access_private.treasury_available(entry.fund,c);
  if change_amount<0 and current_available+change_amount<least(0,current_available)
   and (entry.fund<>'investment' or exists(select 1 from studio_access_private.treasury_reservations where fund=entry.fund and currency=c and status='reserved'))
  then raise exception 'La corrección dejaría fondos insuficientes o afectaría un presupuesto reservado'; end if;
 end loop;
 if p_delete then
  select to_jsonb(r) into receipt_data from studio_access_private.treasury_receipts r where movement_id=p_id;
  delete from studio_access_private.treasury_receipts where movement_id=p_id;
  delete from studio_access_private.treasury_ledger where id=p_id;
 else
  update studio_access_private.treasury_ledger set
   concept=btrim(p_concept), occurred_on=p_date, area=p_area, currency=p_currency, amount=p_amount,
   metadata=case when metadata ? 'registration' or p_rate is not null then metadata||jsonb_build_object('registration',
    coalesce(metadata->'registration','{}'::jsonb)||jsonb_build_object('date',p_date,'area',p_area,'rate',p_rate)) else metadata end
   where id=p_id returning * into result;
 end if;
 insert into studio_access_private.treasury_movement_corrections(operation_id,movement_id,actor,request,previous_entry,resulting_entry,deleted_receipt)
 values(p_operation,p_id,auth.uid(),request_data,to_jsonb(entry),case when p_delete then null else to_jsonb(result) end,receipt_data);
end $$;
revoke all on function public.treasury_correct_movement(uuid,uuid,jsonb,boolean,text,date,text,text,numeric,numeric) from public,anon;
grant execute on function public.treasury_correct_movement(uuid,uuid,jsonb,boolean,text,date,text,text,numeric,numeric) to authenticated;
