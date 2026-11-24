begin;
alter table public.purchase_budget_requests
 add column kind text,
 add column priority text,
 add column items jsonb,
 add column details jsonb,
 add column totals jsonb,
 add column direct_to_manager boolean not null default false;
alter table public.purchase_budget_requests drop constraint purchase_budget_requests_area_check;
alter table public.purchase_budget_requests add constraint purchase_budget_requests_area_check check(area in ('Audiovisual','Gráfica','Generales'));
create or replace function public.purchase_budget_capabilities() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'request',studio_access_private.inventory_order_role('gestor_tecnico'),
 'audiovisual',studio_access_private.inventory_order_role('jefe_audiovisuales'),
 'graphics',studio_access_private.inventory_order_role('jefe_grafica'),
 'administrator',studio_access_private.inventory_order_role('administrador') or exists(select 1 from public.system_access_roles r where r.id=studio_access_private.trial_account_role() and r.code='administrador'),
 'manager',studio_access_private.inventory_order_role('manager_general'),
 'owner',studio_access_private.is_owner());
$$;
alter policy purchase_budget_read on public.purchase_budget_requests using (
 requester=auth.uid() or (public.purchase_budget_capabilities()->>'owner')::boolean
 or (not direct_to_manager and area='Audiovisual' and (public.purchase_budget_capabilities()->>'audiovisual')::boolean)
 or (not direct_to_manager and area='Gráfica' and (public.purchase_budget_capabilities()->>'graphics')::boolean)
 or ((direct_to_manager or chief_at is not null) and status<>'chief_pending' and (status<>'rejected' or manager_at is not null)
     and (public.purchase_budget_capabilities()->>'manager')::boolean)
);
create function public.purchase_budget_submit_form(p_id uuid,p_form jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare
 caps jsonb:=public.purchase_budget_capabilities();
 area_name text:=p_form->>'area'; kind_name text:=p_form->>'kind'; priority_name text:=p_form->>'priority';
 explanation text:=btrim(coalesce(p_form->>'reason',''));
 detail_data jsonb:=coalesce(p_form->'details','{}');
 line jsonb; clean_items jsonb:='[]'; qty numeric; unit_price numeric; subtotal numeric; line_name text; curr text; unit_name text;
 usd numeric:=0; cup numeric:=0; total_qty numeric:=0; direct boolean; previous public.purchase_budget_requests%rowtype;
begin
 if auth.uid() is null or p_id is null or jsonb_typeof(p_form)<>'object' then raise exception 'Solicitud inválida'; end if;
 direct:=coalesce((caps->>'administrator')::boolean,false) or coalesce((caps->>'audiovisual')::boolean,false) or coalesce((caps->>'graphics')::boolean,false);
 if not direct and not coalesce((caps->>'request')::boolean,false) then raise exception 'Tu rol no puede solicitar presupuesto.' using errcode='42501';end if;
 if area_name is null or area_name not in ('Audiovisual','Gráfica','Generales') or (not direct and area_name='Generales') then raise exception 'Selecciona un área válida';end if;
 if direct and not (caps->>'administrator')::boolean and not ((area_name='Audiovisual' and (caps->>'audiovisual')::boolean) or (area_name='Gráfica' and (caps->>'graphics')::boolean)) then raise exception 'Solicita presupuesto para tu propia área' using errcode='42501';end if;
 if kind_name is null or kind_name not in ('Abastecimiento de Nevera Audiovisual','Compra de herramientas','Materiales de mantenimiento','Materias primas e insumos','Equipos y accesorios','Repuestos y componentes','Reparaciones y servicios técnicos','Otros gastos') then raise exception 'Selecciona el tipo de presupuesto';end if;
 if kind_name='Abastecimiento de Nevera Audiovisual' and area_name<>'Audiovisual' then raise exception 'La nevera corresponde al área Audiovisual';end if;
 if priority_name is null or priority_name not in ('Normal','Urgente','Crítica') or length(explanation) not between 1 and 1500 then raise exception 'Completa la prioridad y justificación';end if;
 if jsonb_typeof(detail_data)<>'object' or length(detail_data::text)>9000 or (kind_name='Otros gastos' and length(btrim(coalesce(detail_data->>'concept',''))) not between 1 and 160) then raise exception 'Completa los detalles de la solicitud';end if;
 if jsonb_typeof(p_form->'items') is distinct from 'array' or jsonb_array_length(p_form->'items') not between 1 and 100 then raise exception 'Agrega entre 1 y 100 artículos';end if;
 for line in select value from jsonb_array_elements(p_form->'items') loop
  line_name:=btrim(coalesce(line->>'name','')); qty:=(line->>'quantity')::numeric; unit_price:=(line->>'unit_price')::numeric; curr:=line->>'currency'; unit_name:=btrim(coalesce(line->>'unit',''));
  if length(line_name) not between 1 and 160 or length(unit_name) not between 1 and 40 or qty is null or qty<=0 or qty>=1000000 or qty<>round(qty,3) or unit_price is null or unit_price<=0 or unit_price>=100000000000 or unit_price<>round(unit_price,2) or curr is null or curr not in ('USD','CUP') then raise exception 'Revisa nombre, unidad, cantidad, precio y moneda de cada artículo';end if;
  subtotal:=round(qty*unit_price,2);
  if subtotal<=0 or subtotal>=100000000000 then raise exception 'Importe de artículo inválido';end if;
  clean_items:=clean_items||jsonb_build_array(jsonb_build_object('name',line_name,'unit',unit_name,'quantity',qty,'unit_price',unit_price,'currency',curr,'subtotal',subtotal));
  if curr='USD' then usd:=usd+subtotal;else cup:=cup+subtotal;end if;
  total_qty:=total_qty+qty;
 end loop;
 if total_qty>=1000000 or usd>=100000000000 or cup>=100000000000 then raise exception 'El presupuesto excede el límite permitido';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into previous from public.purchase_budget_requests where id=p_id;
 if found then
  if previous.requester=auth.uid() and previous.area=area_name and previous.kind=kind_name and previous.priority=priority_name and previous.reason=explanation and previous.details=detail_data and previous.items=clean_items then return;end if;
  raise exception 'El identificador ya pertenece a otra solicitud';
 end if;
 insert into public.purchase_budget_requests(id,requester_name,area,product,quantity,amount,currency,reason,status,kind,priority,items,details,totals,direct_to_manager)
 values(p_id,studio_access_private.inventory_actor_name(),area_name,case when kind_name='Otros gastos' then btrim(detail_data->>'concept') else kind_name end,total_qty,case when cup>0 then cup else usd end,case when cup>0 then 'CUP' else 'USD' end,explanation,case when direct then 'manager_pending' else 'chief_pending' end,kind_name,priority_name,clean_items,detail_data,jsonb_build_object('USD',usd,'CUP',cup),direct);
end;
$$;
revoke all on function public.purchase_budget_submit_form(uuid,jsonb) from public,anon;
grant execute on function public.purchase_budget_submit_form(uuid,jsonb) to authenticated;
commit;
