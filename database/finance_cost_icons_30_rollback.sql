select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
do $$declare d text;begin
if exists(select 1 from studio_access_private.finance_cost_sheets where icon_code not in ('sheet','building','camera','palette','briefcase','users','wrench','package','headphones','monitor','megaphone','settings','folder')) or exists(select 1 from studio_access_private.finance_cost_versions where icon_code not in ('sheet','building','camera','palette','briefcase','users','wrench','package','headphones','monitor','megaphone','settings','folder')) then raise exception 'Hay iconos nuevos en uso; conserva el catálogo ampliado para no perder selecciones';end if;
select definition into strict d from studio_access_private.finance_cost_backups where name='icons30.finance_cost_command';execute d;end $$;
alter table studio_access_private.finance_cost_sheets drop constraint finance_cost_sheets_icon_code_check;
alter table studio_access_private.finance_cost_sheets add constraint finance_cost_sheets_icon_code_check check(icon_code in ('sheet','building','camera','palette','briefcase','users','wrench','package','headphones','monitor','megaphone','settings','folder'));
alter table studio_access_private.finance_cost_versions drop constraint finance_cost_versions_icon_code_check;
alter table studio_access_private.finance_cost_versions add constraint finance_cost_versions_icon_code_check check(icon_code in ('sheet','building','camera','palette','briefcase','users','wrench','package','headphones','monitor','megaphone','settings','folder'));
