-- Manual income, withdrawals and fund transfers use one combined balance at the declared exchange rate.
create or replace function public.treasury_register_movement(
 p_id uuid,p_fund text,p_currency text,p_amount numeric,p_concept text,p_date date,p_area text,p_category text,p_rate numeric,p_destination text,p_receipt jsonb
) returns void language plpgsql security definer set search_path='' as $$
declare
 entry studio_access_private.treasury_ledger%rowtype;
 movement uuid; details jsonb; key text; receipt_name text; receipt_mime text; receipt_content text;
 from_label text; to_label text; balance_cup numeric; required_cup numeric;
begin
 if auth.uid() is null or not studio_access_private.fridge_manager() then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 if p_id is null or p_fund is null or p_currency is null or p_currency not in ('CUP','USD')
  or p_amount is null or p_amount=0 or abs(p_amount)>999999999999 or p_amount<>round(p_amount,2)
  or length(btrim(coalesce(p_concept,''))) not between 1 and 500
  or p_date is null or p_area is null or p_area not in ('AUDIOVISUALES','DISEÑO','GRAFICA','OFICINA','GENERAL')
  or length(btrim(coalesce(p_category,''))) not between 1 and 80
  or p_rate is null or p_rate<=0 or p_rate>1000000 then raise exception 'Datos del movimiento inválidos. Introduce una tasa de cambio válida';end if;
 if p_destination is not null and (p_amount>=0 or p_destination=p_fund) then raise exception 'Traspaso inválido';end if;
 select label into from_label from studio_access_private.treasury_funds where code=p_fund and (p_destination is null or not worker);
 if from_label is null then raise exception 'Fondo inválido';end if;
 if p_destination is not null then
  select label into to_label from studio_access_private.treasury_funds where code=p_destination and not worker;
  if to_label is null then raise exception 'Fondo de destino inválido';end if;
 end if;
 if p_receipt is not null then
  receipt_name:=p_receipt->>'name';receipt_mime:=p_receipt->>'mime';receipt_content:=p_receipt->>'content';
  if length(coalesce(receipt_name,'')) not between 1 and 240 or coalesce(receipt_mime,'') not in ('image/jpeg','image/png','image/webp','application/pdf') or length(coalesce(receipt_content,'')) not between 1 and 2800000 or receipt_content !~ '^[A-Za-z0-9+/]+={0,2}$' then raise exception 'Comprobante inválido';end if;
  perform decode(receipt_content,'base64');
 end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.treasury',0));
 key:=case when p_destination is null then 'manual:'||p_id else 'transfer:'||p_id||':out' end;
 details:=jsonb_build_object('date',p_date,'area',p_area,'category',btrim(p_category),'rate',p_rate,'receipt',receipt_name);
 select * into entry from studio_access_private.treasury_ledger where source_key=key;
 if found then
  if entry.metadata->'registration' is distinct from details or entry.fund is distinct from p_fund or entry.currency is distinct from p_currency or entry.amount is distinct from p_amount or entry.actor is distinct from auth.uid()
   or (p_destination is null and entry.concept is distinct from btrim(p_concept))
   or (p_destination is not null and (entry.metadata->>'destination' is distinct from p_destination or entry.metadata->>'reason' is distinct from btrim(p_concept))) then raise exception 'Identificador ya utilizado';end if;
  if p_receipt is not null and not exists(select 1 from studio_access_private.treasury_receipts where movement_id=entry.id and name=receipt_name and mime=receipt_mime and content=receipt_content) then raise exception 'Comprobante distinto';end if;
  return;
 end if;
 if exists(select 1 from studio_access_private.treasury_movement_corrections where previous_entry->>'source_key'=key and resulting_entry is null) then raise exception 'El movimiento original fue eliminado';end if;
 if p_amount<0 then
  balance_cup:=studio_access_private.treasury_available(p_fund,'CUP')+studio_access_private.treasury_available(p_fund,'USD')*p_rate;
  required_cup:=-p_amount*case when p_currency='USD' then p_rate else 1 end;
  if balance_cup<required_cup and (p_destination is not null or p_fund<>'investment' or exists(select 1 from studio_access_private.treasury_reservations where fund=p_fund and status='reserved')) then
   raise exception 'Saldo disponible total insuficiente';
  end if;
 end if;
 if p_destination is null then
  insert into studio_access_private.treasury_ledger(fund,currency,amount,occurred_on,concept,area,source,source_key,actor,metadata)
  values(p_fund,p_currency,p_amount,p_date,btrim(p_concept),p_area,'manual',key,auth.uid(),jsonb_build_object('registration',details)) returning id into movement;
 else
  insert into studio_access_private.treasury_ledger(fund,currency,amount,occurred_on,concept,area,source,source_key,actor,metadata)
  values(p_fund,p_currency,p_amount,p_date,'Traspaso a '||to_label||' · '||btrim(p_concept),p_area,'transfer',key,auth.uid(),jsonb_build_object('destination',p_destination,'reason',btrim(p_concept),'registration',details)) returning id into movement;
  insert into studio_access_private.treasury_ledger(fund,currency,amount,occurred_on,concept,area,source,source_key,actor,metadata)
  values(p_destination,p_currency,-p_amount,p_date,'Traspaso desde '||from_label||' · '||btrim(p_concept),p_area,'transfer','transfer:'||p_id||':in',auth.uid(),jsonb_build_object('origin',p_fund,'reason',btrim(p_concept),'registration',details));
 end if;
 if p_receipt is not null then insert into studio_access_private.treasury_receipts values(movement,receipt_name,receipt_mime,receipt_content);end if;
end $$;
revoke all on function public.treasury_register_movement(uuid,text,text,numeric,text,date,text,text,numeric,text,jsonb) from public,anon;
grant execute on function public.treasury_register_movement(uuid,text,text,numeric,text,date,text,text,numeric,text,jsonb) to authenticated;
