-- Expand the allowed vector identifiers; never rewrite existing icon selections.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
insert into studio_access_private.finance_cost_backups(name,definition) select 'icons30.'||p.proname,pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace='studio_access_private'::regnamespace and p.proname='finance_cost_command';
alter table studio_access_private.finance_cost_sheets drop constraint finance_cost_sheets_icon_code_check;
alter table studio_access_private.finance_cost_sheets add constraint finance_cost_sheets_icon_code_check check(icon_code in ('sheet','building','camera','palette','briefcase','users','wrench','package','headphones','monitor','megaphone','settings','folder','bar','fridge','coffee','bottle','wine','beer','food','snacks','cart','store','receipt','calculator','coins','chart','printer','film','music'));
alter table studio_access_private.finance_cost_versions drop constraint finance_cost_versions_icon_code_check;
alter table studio_access_private.finance_cost_versions add constraint finance_cost_versions_icon_code_check check(icon_code in ('sheet','building','camera','palette','briefcase','users','wrench','package','headphones','monitor','megaphone','settings','folder','bar','fridge','coffee','bottle','wine','beer','food','snacks','cart','store','receipt','calculator','coins','chart','printer','film','music'));
do $$declare d text;old_codes text:='(''sheet'',''building'',''camera'',''palette'',''briefcase'',''users'',''wrench'',''package'',''headphones'',''monitor'',''megaphone'',''settings'',''folder'')';new_codes text:='(''sheet'',''building'',''camera'',''palette'',''briefcase'',''users'',''wrench'',''package'',''headphones'',''monitor'',''megaphone'',''settings'',''folder'',''bar'',''fridge'',''coffee'',''bottle'',''wine'',''beer'',''food'',''snacks'',''cart'',''store'',''receipt'',''calculator'',''coins'',''chart'',''printer'',''film'',''music'')';begin
select pg_get_functiondef('studio_access_private.finance_cost_command(uuid,text,jsonb)'::regprocedure) into strict d;
if (length(d)-length(replace(d,old_codes,'')))/length(old_codes)<>2 then raise exception 'La validación de iconos cambió; revisar antes de migrar';end if;
execute replace(d,old_codes,new_codes);
end $$;
