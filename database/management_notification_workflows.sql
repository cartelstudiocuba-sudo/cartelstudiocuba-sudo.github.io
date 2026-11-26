create or replace function studio_access_private.management_notice_workflow() returns trigger language plpgsql security definer set search_path='' as $$
declare recipients uuid[]; managers uuid[]; owner_id uuid:='6418ad20-d0e8-49c0-8d9a-e1da3daf71b6'; route text; label text; state text; sender uuid;
begin
 if tg_op='UPDATE' and new.status is not distinct from old.status then return new;end if;
 select coalesce(array_agg(user_id),'{}'::uuid[]) into managers from studio_access_private.management_notice_roles(array['manager_general']);
 state:=new.status;
 if tg_table_name='purchase_budget_requests' then
  sender:=new.requester;route:='/inventario-presupuesto.html?request='||new.id;label:='Solicitud de presupuesto';
  if state='chief_pending' then select coalesce(array_agg(user_id),'{}'::uuid[]) into recipients from studio_access_private.management_notice_roles(array[case when new.area='Gráfica' then 'jefe_grafica' else 'jefe_audiovisuales' end]);
  elsif state='manager_pending' then recipients:=array_remove(managers,new.chief_by);
   if tg_op='UPDATE' then perform studio_access_private.management_notice(array[new.requester],label,'Aprobada por el jefe de área; pendiente de la Manager General',route);end if;
  elsif state in ('approved','rejected') then recipients:=array[new.requester,new.chief_by];
  else return new;end if;
 elsif tg_table_name='inventory_orders' then
  sender:=new.created_by;label:='Solicitud de insumos';
  if state='pending' then recipients:=managers||owner_id;route:='/inventario-aprobaciones.html?request='||new.id;
  elsif state in ('approved','rejected','returned','partial','delivered','cancelled') then recipients:=array[new.created_by];route:='/inventario-solicitud.html?request='||new.id;
  else return new;end if;
  if state='approved' then
   perform studio_access_private.management_notice(array(select user_id from studio_access_private.management_notice_roles(array['administrador'])),label,'Solicitud aprobada; preparar la entrega','/inventario-pedidos.html?request='||new.id);
  end if;
 elsif tg_table_name='fridge_reconciliations' then
  sender:=new.created_by;label:='Cuadre de nevera';
  if state='pending' then recipients:=managers||owner_id;route:='/cuadre-nevera.html?request='||new.id;
  elsif state in ('returned','confirmed') then recipients:=array[new.created_by];route:='/cuadre-nevera.html?request='||new.id;
  else return new;end if;
 elsif tg_table_name='treasury_ceo_dispatch' then
  sender:=new.created_by;label:='Cuadre de utilidad';
  if state='pending' then recipients:=array[owner_id];elsif state='confirmed' then recipients:=array[new.created_by];else return new;end if;
  route:='/tesoreria.html';
 else return new;end if;
 if state in ('chief_pending','manager_pending','pending') then recipients:=array_remove(recipients,sender);end if;
 perform studio_access_private.management_notice(recipients,label,case state when 'chief_pending' then 'Pendiente de aprobación del jefe de área' when 'manager_pending' then 'Pendiente de aprobación de la Manager General' when 'pending' then 'Pendiente de revisión' when 'approved' then 'Aprobado' when 'rejected' then 'Rechazado' when 'partial' then 'Entrega parcial registrada' when 'delivered' then 'Entrega confirmada' when 'cancelled' then 'Cancelado' when 'returned' then 'Devuelto para revisión' when 'confirmed' then 'Recibido confirmado' end,route);
 return new;
end $$;

create function studio_access_private.management_notice_budget_delivery() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.purchase_budget_requests%rowtype;
begin
 if new.status='delivered' and old.status is distinct from new.status then
  select * into r from public.purchase_budget_requests where id=new.request_id;
  perform studio_access_private.management_notice(array[r.requester,r.chief_by,r.manager_by],'Solicitud de presupuesto','Recibido confirmado','/inventario-presupuesto.html?request='||r.id);
 end if;
 return new;
end $$;
create trigger management_budget_delivery_notice after update of status on studio_access_private.treasury_reservations for each row execute function studio_access_private.management_notice_budget_delivery();

create function studio_access_private.management_notice_hr() returns trigger language plpgsql security definer set search_path='' as $$
declare candidate uuid;
begin
 if new.submitted_at is null then return new;end if;
 if tg_op='UPDATE' and old.submitted_at is not distinct from new.submitted_at then return new;end if;
 select candidate_id into candidate from public.hr_trial_periods where id=new.trial_id;
 if candidate is not null then
  perform studio_access_private.management_notice(array['6418ad20-d0e8-49c0-8d9a-e1da3daf71b6'::uuid],case when tg_table_name='hr_hiring_cases' then 'Expediente de contratación' else 'Cierre de prueba' end,'Documentación recibida; pendiente de revisión','/dashboard.html?section=captacion&candidate='||candidate);
 end if;
 return new;
end $$;
create trigger management_hiring_notice after insert or update of submitted_at on public.hr_hiring_cases for each row execute function studio_access_private.management_notice_hr();
create trigger management_trial_closure_notice after insert or update of submitted_at on public.hr_trial_closures for each row execute function studio_access_private.management_notice_hr();
revoke all on function studio_access_private.management_notice_budget_delivery(),studio_access_private.management_notice_hr() from public,anon,authenticated;
