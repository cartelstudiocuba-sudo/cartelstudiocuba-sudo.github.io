-- USD inventory cutover: original historical CUP amounts remain unchanged.
ALTER TABLE public.inventory_products ADD COLUMN cost_conversion jsonb;
ALTER TABLE public.inventory_movements ADD COLUMN usd_unit_cost numeric;
ALTER TABLE public.inventory_movements ADD COLUMN usd_reference jsonb;
ALTER TABLE public.inventory_economic_movements ADD COLUMN usd_unit_cost numeric;
ALTER TABLE public.inventory_economic_movements ADD COLUMN usd_reference jsonb;
DO $cutover$ DECLARE rate numeric; stamp timestamptz; source text; BEGIN
 SELECT (rates->>'USD')::numeric,fetched_at,source_url INTO rate,stamp,source FROM public.dashboard_exchange_rate_cache WHERE id='eltoque-informal';
 IF rate IS NULL OR rate<=0 OR rate>='Infinity'::numeric OR stamp<now()-interval '48 hours' THEN RAISE EXCEPTION 'Falta una tasa verificada reciente para expresar los costos en USD'; END IF;
 UPDATE public.inventory_products SET cost_conversion=jsonb_build_object('original_currency',currency,'original_unit_cost',unit_cost,'original_reference_cost',reference_cost,'cup_per_usd',rate,'rate_fetched_at',stamp,'source',source,'normalized_at',now()),currency='USD',unit_cost=round(unit_cost/rate,2),reference_cost=CASE WHEN reference_cost IS NOT NULL THEN round(reference_cost/rate,2) END WHERE currency='CUP';
 UPDATE public.inventory_movements SET usd_reference=CASE WHEN currency='CUP' THEN jsonb_build_object('original_currency',currency,'original_unit_cost',unit_cost,'cup_per_usd',rate,'rate_fetched_at',stamp,'source',source,'purpose','USD reporting reference at cutover') END,usd_unit_cost=CASE WHEN currency='CUP' THEN round(unit_cost/rate,2) ELSE unit_cost END WHERE usd_unit_cost IS NULL;
 UPDATE public.inventory_economic_movements SET usd_unit_cost=CASE WHEN currency='CUP' THEN round(unit_cost/rate,2) ELSE unit_cost END WHERE usd_unit_cost IS NULL;
END $cutover$;
CREATE OR REPLACE FUNCTION public.inventory_cup_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $guard$
DECLARE c text; conv jsonb; amount numeric; rate numeric;
BEGIN
 PERFORM pg_advisory_xact_lock(761820261018::bigint);
 SELECT currency INTO STRICT c FROM public.inventory_products WHERE id=new.product_id;
 IF c<>'USD' OR new.currency IS DISTINCT FROM 'USD' THEN RAISE EXCEPTION 'Los movimientos nuevos se registran en USD'; END IF;
 IF new.kind='entry' THEN
  IF new.unit_cost IS NULL OR new.unit_cost<0 OR new.unit_cost>='Infinity'::numeric OR new.unit_cost<>round(new.unit_cost,2) THEN RAISE EXCEPTION 'El precio en USD debe tener como máximo dos decimales'; END IF;
  conv=new.request_payload->'purchase_conversion';
  IF conv IS NOT NULL AND conv<>'null'::jsonb THEN
   IF jsonb_typeof(conv)<>'object' OR conv->>'original_currency' IS DISTINCT FROM 'CUP' THEN RAISE EXCEPTION 'Conversión no válida'; END IF;
   amount=(conv->>'original_unit_cost')::numeric;rate=(conv->>'cup_per_usd')::numeric;
   IF amount IS NULL OR amount<0 OR amount>='Infinity'::numeric OR rate IS NULL OR rate<=0 OR rate>='Infinity'::numeric OR round(amount/rate,2) IS DISTINCT FROM new.unit_cost THEN RAISE EXCEPTION 'El precio USD no coincide con el importe CUP y la tasa declarados'; END IF;
  END IF;
  new.usd_unit_cost=new.unit_cost;
 END IF;
 PERFORM studio_access_private.inventory_check_date(new.occurred_on);
 RETURN new;
END $guard$;
CREATE OR REPLACE FUNCTION public.inventory_apply_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare p public.inventory_products;
begin
 if auth.uid() is null or not public.inventory_has_access('write') then
  raise exception 'Acceso no autorizado' using errcode='42501';
 end if;
 if new.quantity is null or new.quantity<=0 or new.quantity>='Infinity'::numeric then raise exception 'Cantidad no válida'; end if;
 select * into strict p from public.inventory_products where id=new.product_id for update;
 if new.currency is not null and new.currency<>p.currency then raise exception 'La moneda debe coincidir con la del producto'; end if;
 new.currency=p.currency; new.product_name=p.name; new.product_unit=p.unit; new.created_by=auth.uid();
 new.recorded_by_name=studio_access_private.inventory_actor_name();
 new.usd_unit_cost=case when new.kind='out' then p.unit_cost else new.unit_cost end;
 if new.kind='entry' then
  if new.unit_cost is null or new.unit_cost<0 or new.unit_cost>='Infinity'::numeric then raise exception 'Costo no válido'; end if;
  if length(coalesce(new.request_payload->>'location',''))>200 then raise exception 'Ubicación demasiado larga'; end if;
  -- Apply location under the same trigger-only RLS boundary as stock and cost.
  update public.inventory_products set unit_cost=new.unit_cost,stock=stock+new.quantity,
   cost_conversion=new.request_payload->'purchase_conversion',
   location=coalesce(nullif(btrim(new.request_payload->>'location'),''),location) where id=p.id;
 elsif new.kind='out' then
  if p.stock<new.quantity then raise exception 'Existencias insuficientes'; end if;
  if new.allocation_type is null or nullif(trim(new.receiving_area),'') is null or nullif(trim(new.received_by),'') is null or (new.allocation_type='project' and nullif(trim(new.project_reference),'') is null) then raise exception 'Complete la imputación económica y el receptor'; end if;
  new.unit_cost=p.unit_cost;
  update public.inventory_products set stock=stock-new.quantity where id=p.id;
  insert into public.inventory_economic_movements(occurred_on,product_id,product_name,quantity,unit_cost,currency,allocation_type,project_reference,receiving_area,received_by,source_movement_id,created_by)
  values(new.occurred_on,p.id,p.name,new.quantity,new.unit_cost,p.currency,new.allocation_type,case when new.allocation_type='project' then new.project_reference end,new.receiving_area,new.received_by,new.id,auth.uid());
 else raise exception 'Tipo de movimiento no válido'; end if;
 return new;
end $function$
;
CREATE TABLE public.inventory_usd_purchase_ledger(
 movement_id uuid PRIMARY KEY REFERENCES public.inventory_movements(id),occurred_on date NOT NULL,amount numeric NOT NULL CHECK(amount<=0 AND amount>'-Infinity'::numeric),currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'),actor_id uuid NOT NULL REFERENCES auth.users(id),request_payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.inventory_usd_purchase_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventory_usd_purchase_ledger FROM anon,authenticated;
GRANT SELECT ON public.inventory_usd_purchase_ledger TO authenticated;
CREATE POLICY inventory_usd_purchase_read ON public.inventory_usd_purchase_ledger FOR SELECT TO authenticated USING ((SELECT public.inventory_has_access('read')));
CREATE OR REPLACE FUNCTION studio_access_private.inventory_purchase_ledger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $ledger$
BEGIN
 IF auth.uid() IS NULL OR NOT public.inventory_has_access('write') THEN RAISE EXCEPTION 'Acceso no autorizado' USING ERRCODE='42501';END IF;
 IF new.kind='entry' THEN
  IF new.currency='USD' THEN
   INSERT INTO public.inventory_usd_purchase_ledger(movement_id,occurred_on,amount,currency,actor_id,request_payload) VALUES(new.id,new.occurred_on,-round(new.quantity*new.unit_cost,2),'USD',auth.uid(),coalesce(new.request_payload,'{}'));
  ELSE RAISE EXCEPTION 'Las compras nuevas requieren USD'; END IF;
 END IF;
 RETURN new;
END $ledger$;


-- Same trigger-only RLS boundary as the existing cost and stock columns.
GRANT UPDATE(cost_conversion) ON public.inventory_products TO authenticated;
