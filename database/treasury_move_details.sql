create table if not exists studio_access_private.treasury_receipts (
 movement_id uuid primary key references studio_access_private.treasury_ledger(id),
 name text not null, mime text not null, content text not null
);
alter table studio_access_private.treasury_receipts enable row level security;
revoke all on studio_access_private.treasury_receipts from public,anon,authenticated;
create or replace function public.treasury_register_movement(
 p_id uuid,p_fund text,p_currency text,p_amount numeric,p_concept text,p_date date,p_area text,p_category text,p_rate numeric,p_destination text,p_receipt jsonb
) returns void language plpgsql security definer set search_path='' as $$
declare movement uuid; details jsonb; existing jsonb; key text; receipt_name text; receipt_mime text; receipt_content text;
begin
 if not studio_access_private.fridge_manager() then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 if p_id is null or p_currency is null or p_currency not in ('CUP','USD') or p_amount is null or p_amount=0 or p_date is null or p_area is null or p_area not in ('AUDIOVISUALES','DISEÑO','GRAFICA','OFICINA','GENERAL') or length(btrim(coalesce(p_category,''))) not between 1 and 80 or p_rate is not null and (p_rate<=0 or p_rate>1000000) then raise exception 'Datos del movimiento inválidos';end if;
 if p_destination is not null and p_amount>=0 then raise exception 'Traspaso inválido';end if;
 if p_receipt is not null then
 receipt_name:=p_receipt->>'name';receipt_mime:=p_receipt->>'mime';receipt_content:=p_receipt->>'content';
 if length(coalesce(receipt_name,'')) not between 1 and 240 or coalesce(receipt_mime,'') not in ('image/jpeg','image/png','image/webp','application/pdf') or length(coalesce(receipt_content,'')) not between 1 and 2800000 or receipt_content !~ '^[A-Za-z0-9+/]+={0,2}$' then raise exception 'Comprobante inválido';end if;
 perform decode(receipt_content,'base64');
 end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.treasury',0));
 key:=case when p_destination is null then 'manual:'||p_id else 'transfer:'||p_id||':out' end;
 details:=jsonb_build_object('date',p_date,'area',p_area,'category',btrim(p_category),'rate',p_rate,'receipt',receipt_name);
 select id,metadata->'registration' into movement,existing from studio_access_private.treasury_ledger where source_key=key;
 if movement is not null and existing is distinct from details then raise exception 'Identificador ya utilizado';end if;
 if p_destination is null then perform public.treasury_move(p_id,p_fund,p_currency,p_amount,p_concept);
 else perform public.treasury_transfer(p_id,p_fund,p_destination,p_currency,-p_amount,p_concept);end if;
 if movement is not null then
 if p_receipt is not null and not exists(select 1 from studio_access_private.treasury_receipts where movement_id=movement and name=receipt_name and mime=receipt_mime and content=receipt_content) then raise exception 'Comprobante distinto';end if;
 return;
 end if;
 update studio_access_private.treasury_ledger set occurred_on=p_date,area=p_area,metadata=metadata||jsonb_build_object('registration',details) where source_key=key returning id into movement;
 if p_destination is not null then update studio_access_private.treasury_ledger set occurred_on=p_date,area=p_area,metadata=metadata||jsonb_build_object('registration',details) where source_key='transfer:'||p_id||':in';end if;
 if p_receipt is not null then insert into studio_access_private.treasury_receipts values(movement,receipt_name,receipt_mime,receipt_content);end if;
end $$;
create or replace function public.treasury_receipt(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not studio_access_private.fridge_manager() then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 return (select jsonb_build_object('name',name,'mime',mime,'content',content) from studio_access_private.treasury_receipts where movement_id=p_id);
end $$;
revoke all on function public.treasury_register_movement(uuid,text,text,numeric,text,date,text,text,numeric,text,jsonb),public.treasury_receipt(uuid) from public,anon;
grant execute on function public.treasury_register_movement(uuid,text,text,numeric,text,date,text,text,numeric,text,jsonb),public.treasury_receipt(uuid) to authenticated;
create or replace function public.treasury_history_filtered(p_fund text, p_offset integer, p_month date, p_kind text, p_currency text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not studio_access_private.fridge_manager() then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('all','income','expense') or p_currency is null or p_currency not in ('all','CUP','USD') then raise exception 'Filtro inválido'; end if;
 return coalesce((select jsonb_agg(to_jsonb(t) order by occurred_on desc nulls last,created_at desc,id) from (
 select id,occurred_on,concept,area,amount,currency,source,created_at,metadata->'registration'->>'category' as category,metadata->'registration'->>'rate' as declared_rate,exists(select 1 from studio_access_private.treasury_receipts r where r.movement_id=treasury_ledger.id) as has_receipt
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
