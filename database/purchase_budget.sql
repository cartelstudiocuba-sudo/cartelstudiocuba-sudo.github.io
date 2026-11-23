begin;
create table public.purchase_budget_requests (
 id uuid primary key,
 requester uuid not null default auth.uid(),
 requester_name text not null,
 area text not null check(area in ('Audiovisual','Gráfica')),
 product text not null check(length(btrim(product)) between 1 and 160),
 quantity numeric not null check(quantity > 0 and quantity < 1000000),
 amount numeric(14,2) not null check(amount > 0 and amount < 100000000000),
 currency text not null check(currency in ('USD','CUP')),
 reason text not null check(length(btrim(reason)) between 1 and 1500),
 status text not null default 'chief_pending' check(status in ('chief_pending','manager_pending','approved','rejected')),
 created_at timestamptz not null default now(),
 chief_by uuid, chief_at timestamptz, chief_note text,
 manager_by uuid, manager_at timestamptz, manager_note text
);
alter table public.purchase_budget_requests enable row level security;
revoke all on public.purchase_budget_requests from public,anon,authenticated;
grant select on public.purchase_budget_requests to authenticated;
create function public.purchase_budget_capabilities() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'request',studio_access_private.inventory_order_role('gestor_tecnico'),
 'audiovisual',studio_access_private.inventory_order_role('jefe_audiovisuales'),
 'graphics',studio_access_private.inventory_order_role('jefe_grafica'),
 'manager',studio_access_private.inventory_order_role('manager_general'),
 'owner',studio_access_private.is_owner());
$$;
create policy purchase_budget_read on public.purchase_budget_requests for select to authenticated using (
 requester = auth.uid()
 or (public.purchase_budget_capabilities()->>'owner')::boolean
 or (area = 'Audiovisual' and (public.purchase_budget_capabilities()->>'audiovisual')::boolean)
 or (area = 'Gráfica' and (public.purchase_budget_capabilities()->>'graphics')::boolean)
 or (chief_at is not null and status <> 'chief_pending' and (status <> 'rejected' or manager_at is not null)
     and (public.purchase_budget_capabilities()->>'manager')::boolean)
);
create function public.purchase_budget_submit(p_id uuid,p_area text,p_product text,p_quantity numeric,p_amount numeric,p_currency text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not (public.purchase_budget_capabilities()->>'request')::boolean then
  raise exception 'Tu rol no puede solicitar presupuesto.' using errcode='42501';
 end if;
 insert into public.purchase_budget_requests(id,requester_name,area,product,quantity,amount,currency,reason)
 values(p_id,studio_access_private.inventory_actor_name(),p_area,btrim(p_product),p_quantity,p_amount,p_currency,btrim(p_reason))
 on conflict (id) do nothing;
 if not found and not exists (
  select 1 from public.purchase_budget_requests where id=p_id and requester=auth.uid()
   and area=p_area and product=btrim(p_product) and quantity=p_quantity and amount=round(p_amount,2)
   and currency=p_currency and reason=btrim(p_reason)
 ) then raise exception 'La solicitud ya existe con otros datos.'; end if;
end;
$$;
create function public.purchase_budget_decide(p_id uuid,p_stage text,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare
 request public.purchase_budget_requests%rowtype;
 caps jsonb := public.purchase_budget_capabilities();
 note text := nullif(btrim(p_note),'');
begin
 if auth.uid() is null or p_approve is null or p_stage is null or p_stage not in ('chief_pending','manager_pending') then
  raise exception 'Decisión inválida.';
 end if;
 if length(note)>1500 or (not p_approve and note is null) then raise exception 'Indica el motivo de la decisión.'; end if;
 select * into request from public.purchase_budget_requests where id=p_id for update;
 if not found or request.requester=auth.uid() or not coalesce(
   case p_stage when 'chief_pending' then
    (caps->>case request.area when 'Audiovisual' then 'audiovisual' else 'graphics' end)::boolean
   else (caps->>'manager')::boolean end,false)
 then raise exception 'Tu rol no puede decidir esta solicitud.' using errcode='42501'; end if;
 if request.status<>p_stage then raise exception 'La solicitud ya cambió de estado. Actualiza la lista.'; end if;
 if p_stage='chief_pending' then
  update public.purchase_budget_requests set status=case when p_approve then 'manager_pending' else 'rejected' end,
   chief_by=auth.uid(),chief_at=now(),chief_note=note where id=p_id;
 else
  if request.chief_by=auth.uid() then raise exception 'La aprobación final requiere otra persona.'; end if;
  update public.purchase_budget_requests set status=case when p_approve then 'approved' else 'rejected' end,
   manager_by=auth.uid(),manager_at=now(),manager_note=note where id=p_id;
 end if;
end;
$$;
revoke all on function public.purchase_budget_capabilities(),public.purchase_budget_submit(uuid,text,text,numeric,numeric,text,text),public.purchase_budget_decide(uuid,text,boolean,text) from public,anon;
grant execute on function public.purchase_budget_capabilities(),public.purchase_budget_submit(uuid,text,text,numeric,numeric,text,text),public.purchase_budget_decide(uuid,text,boolean,text) to authenticated;
commit;
