-- Returned requests preserve their identity and immutable event snapshots.
alter table public.inventory_orders drop constraint inventory_orders_status_check;
alter table public.inventory_orders add constraint inventory_orders_status_check check(status in ('pending','returned','approved','preparing','partial','delivered','rejected','cancelled'));
alter table public.inventory_orders add column revision integer not null default 1 check(revision>0);

create function studio_access_private.inventory_order_return(order_id uuid,note text,expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare o public.inventory_orders;snapshot jsonb;
begin
 if auth.uid() is null or not coalesce((studio_access_private.inventory_order_capabilities()->>'approve')::boolean,false) then raise exception 'Solo el Manager General puede devolver solicitudes' using errcode='42501';end if;
 if nullif(btrim(note),'') is null or length(note)>2000 then raise exception 'Indica el motivo de la devolución (hasta 2000 caracteres)';end if;
 perform pg_advisory_xact_lock(761820261018::bigint);
 select * into strict o from public.inventory_orders where id=$1 for update;
 if o.created_by=auth.uid() then raise exception 'No puedes devolver tu propia solicitud' using errcode='42501';end if;
 if o.revision is distinct from expected_revision then raise exception 'La solicitud cambió. Actualiza antes de decidir';end if;
 if o.status='returned' and o.approved_by=auth.uid() and o.decision_note=btrim(note) then return;end if;
 if o.status<>'pending' then raise exception 'Solo puedes devolver una solicitud pendiente';end if;
 snapshot:=jsonb_build_object('order',to_jsonb(o),'items',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from public.inventory_order_items i where i.order_id=o.id));
 update public.inventory_orders set status='returned',decision_note=btrim(note),approved_by=auth.uid(),approved_by_name=studio_access_private.inventory_actor_name(),approved_at=now() where id=o.id;
 delete from public.inventory_order_reads r where r.order_id=o.id and r.user_id=o.created_by;
 insert into public.inventory_order_events(order_id,actor_id,actor_name,event,details) values(o.id,auth.uid(),studio_access_private.inventory_actor_name(),'returned',jsonb_build_object('note',btrim(note),'revision',o.revision,'snapshot',snapshot));
end $$;

create function studio_access_private.inventory_order_resubmit(order_id uuid,expected_revision integer,request_id uuid,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare c jsonb:=studio_access_private.inventory_order_capabilities();o public.inventory_orders;line jsonb;p public.inventory_products;q numeric;recipient text;pid uuid;prior jsonb;retry record;
begin
 if auth.uid() is null or not coalesce((c->>'create')::boolean,false) then raise exception 'No tienes permiso para solicitar insumos' using errcode='42501';end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' then raise exception 'Corrección no válida';end if;
 perform pg_advisory_xact_lock(761820261018::bigint);
 select * into strict o from public.inventory_orders where id=$1 for update;
 if o.created_by<>auth.uid() then raise exception 'Solo el solicitante puede corregir su pedido' using errcode='42501';end if;
 select e.actor_id,e.details into retry from public.inventory_order_events e where e.order_id=o.id and e.event='resubmitted' and e.details->>'request_id'=request_id::text limit 1;
 if found then
  if retry.actor_id<>auth.uid() or retry.details->'submission'<>payload or (retry.details->>'from_revision')::integer is distinct from expected_revision then raise exception 'El reintento no coincide con la corrección enviada';end if;
  return o.id;
 end if;
 if o.status<>'returned' or o.revision is distinct from expected_revision then raise exception 'La solicitud cambió o no admite correcciones. Actualiza su ficha';end if;
 if exists(select 1 from public.inventory_deliveries d where d.order_id=o.id) or exists(select 1 from public.inventory_order_items i where i.order_id=o.id and (i.approved_quantity<>0 or i.delivered_quantity<>0 or i.prepared_quantity<>0)) then raise exception 'La solicitud ya tiene cantidades comprometidas';end if;
 if payload->>'area' is null or payload->>'purpose' is null or payload->>'area' not in ('Audiovisual','Gráfica','Generales') or payload->>'purpose' not in ('area','project','breakage') then raise exception 'Selecciona área y tipo de consumo';end if;
 if c->>'area' is not null and (payload->>'area'<>c->>'area' or payload->>'purpose'='breakage') then raise exception 'El pedido debe corresponder a tu área' using errcode='42501';end if;
 if payload->>'purpose'='project' and nullif(btrim(payload->>'project_reference'),'') is null then raise exception 'Indica el proyecto';end if;
 if length(coalesce(payload->>'notes',''))>2000 or (payload->>'purpose'='breakage' and nullif(btrim(payload->>'notes'),'') is null) then raise exception 'Indica el motivo de la rotura o merma';end if;
 if nullif(btrim(payload->>'delivery_location'),'') is null or length(payload->>'delivery_location')>200 then raise exception 'Indica el lugar de entrega';end if;
 pid:=nullif(payload->>'recipient_id','')::uuid;
 if pid is not null then select full_name into recipient from public.hr_employees where id=pid and system_access_enabled and system_auth_user_id is not null;else recipient:=btrim(payload->>'recipient_name');end if;
 if recipient is null or length(recipient) not between 1 and 160 then raise exception 'Indica quién recibe';end if;
 if jsonb_typeof(payload->'items') is distinct from 'array' then raise exception 'Agrega los insumos';end if;
 if jsonb_array_length(payload->'items') not between 1 and 100 or (select count(distinct x->>'product_id') from jsonb_array_elements(payload->'items') x)<>jsonb_array_length(payload->'items') then raise exception 'Agrega entre 1 y 100 insumos sin repetir';end if;
 prior:=jsonb_build_object('order',to_jsonb(o),'items',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from public.inventory_order_items i where i.order_id=o.id));
 delete from public.inventory_order_items i where i.order_id=o.id;
 for line in select * from jsonb_array_elements(payload->'items') order by value->>'product_id' loop
  select * into strict p from public.inventory_products where id=(line->>'product_id')::uuid and deleted_at is null for update;
  if c->>'area' is not null and p.department not in (c->>'area','Generales') then raise exception 'Insumo de otra área' using errcode='42501';end if;
  q:=(line->>'quantity')::numeric;
  if q is null or q<=0 or q>='Infinity'::numeric or q>p.stock-studio_access_private.inventory_order_reserved(p.id) or p.currency<>'USD' then raise exception 'La cantidad de % sobrepasa la existencia disponible',p.name;end if;
  insert into public.inventory_order_items(order_id,product_id,product_name,unit,requested_quantity,unit_cost_reference) values(o.id,p.id,p.name,p.unit,q,p.unit_cost);
 end loop;
 update public.inventory_orders set area=payload->>'area',purpose=payload->>'purpose',project_reference=nullif(btrim(payload->>'project_reference'),''),recipient_id=pid,recipient_name=recipient,delivery_location=btrim(payload->>'delivery_location'),needed_on=(now() at time zone 'America/Havana')::date,notes=coalesce(payload->>'notes',''),submission=payload,status='pending',revision=o.revision+1,decision_note=null,approved_by=null,approved_by_name=null,approved_at=null where id=o.id;
 delete from public.inventory_order_reads r where r.order_id=o.id;
 insert into public.inventory_order_events(order_id,actor_id,actor_name,event,details) values(o.id,auth.uid(),studio_access_private.inventory_actor_name(),'resubmitted',jsonb_build_object('request_id',request_id,'from_revision',o.revision,'revision',o.revision+1,'submission',payload,'previous',prior,'snapshot',jsonb_build_object('order',(select to_jsonb(x) from public.inventory_orders x where x.id=o.id),'items',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from public.inventory_order_items i where i.order_id=o.id))));
 return o.id;
end $$;
create function public.inventory_order_return(order_id uuid,note text,expected_revision integer) returns void language sql security invoker set search_path='' as $$select studio_access_private.inventory_order_return(order_id,note,expected_revision)$$;
create function public.inventory_order_resubmit(order_id uuid,expected_revision integer,request_id uuid,payload jsonb) returns uuid language sql security invoker set search_path='' as $$select studio_access_private.inventory_order_resubmit(order_id,expected_revision,request_id,payload)$$;
revoke all on function studio_access_private.inventory_order_return(uuid,text,integer),public.inventory_order_return(uuid,text,integer),studio_access_private.inventory_order_resubmit(uuid,integer,uuid,jsonb),public.inventory_order_resubmit(uuid,integer,uuid,jsonb) from public,anon;
grant execute on function studio_access_private.inventory_order_return(uuid,text,integer),public.inventory_order_return(uuid,text,integer),studio_access_private.inventory_order_resubmit(uuid,integer,uuid,jsonb),public.inventory_order_resubmit(uuid,integer,uuid,jsonb) to authenticated;

-- A returned request may be marked seen only by its creator.
drop policy order_reads_insert on public.inventory_order_reads;
create policy order_reads_insert on public.inventory_order_reads for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.inventory_orders o where o.id=order_id and ((o.status='pending' and (public.inventory_order_capabilities()->>'approve')::boolean) or (o.status='returned' and o.created_by=(select auth.uid())))));
create or replace function public.inventory_order_notifications(p_seen uuid[] default '{}'::uuid[]) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;can_approve boolean:=coalesce((public.inventory_order_capabilities()->>'approve')::boolean,false);
begin
 if auth.uid() is null then raise exception 'Autenticación requerida' using errcode='42501';end if;
 if cardinality(p_seen)>500 then raise exception 'Demasiadas solicitudes';end if;
 insert into public.inventory_order_reads(user_id,order_id) select auth.uid(),o.id from public.inventory_orders o where o.id=any(p_seen) and ((o.status='pending' and can_approve) or (o.status='returned' and o.created_by=auth.uid())) on conflict do nothing;
 select jsonb_build_object('pending',count(*) filter(where o.status='pending' and can_approve),'unseen',count(*) filter(where o.status='pending' and can_approve and r.order_id is null),'corrections',count(*) filter(where o.status='returned' and o.created_by=auth.uid()),'unseen_corrections',count(*) filter(where o.status='returned' and o.created_by=auth.uid() and r.order_id is null)) into result from public.inventory_orders o left join public.inventory_order_reads r on r.order_id=o.id and r.user_id=auth.uid() where (o.status='pending' and can_approve) or (o.status='returned' and o.created_by=auth.uid());
 return result;
end $$;

create function studio_access_private.inventory_order_decide_versioned(order_id uuid,expected_revision integer,decision text,quantities jsonb,note text) returns void language plpgsql security definer set search_path='' as $$
declare o public.inventory_orders;
begin
 if auth.uid() is null or not coalesce((studio_access_private.inventory_order_capabilities()->>'approve')::boolean,false) then raise exception 'Solo el Manager General puede decidir solicitudes' using errcode='42501';end if;
 perform pg_advisory_xact_lock(761820261018::bigint);
 select * into strict o from public.inventory_orders where id=$1 for update;
 if o.revision is distinct from expected_revision then raise exception 'La solicitud cambió. Actualiza antes de decidir';end if;
 perform studio_access_private.inventory_order_decide(order_id,decision,quantities,note);
end $$;
create function public.inventory_order_decide_versioned(order_id uuid,expected_revision integer,decision text,quantities jsonb,note text) returns void language sql security invoker set search_path='' as $$select studio_access_private.inventory_order_decide_versioned(order_id,expected_revision,decision,quantities,note)$$;
revoke all on function studio_access_private.inventory_order_decide_versioned(uuid,integer,text,jsonb,text),public.inventory_order_decide_versioned(uuid,integer,text,jsonb,text) from public,anon;
grant execute on function studio_access_private.inventory_order_decide_versioned(uuid,integer,text,jsonb,text),public.inventory_order_decide_versioned(uuid,integer,text,jsonb,text) to authenticated;
