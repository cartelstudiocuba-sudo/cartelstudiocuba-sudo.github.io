-- Read-only timeline of original registrations and subsequent audited corrections.
create or replace function public.treasury_movement_history(
 p_fund text,p_offset integer,p_month date,p_currency text,p_search text,p_area text
) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not studio_access_private.fridge_manager() then
  raise exception 'Acceso no autorizado' using errcode='42501';
 end if;
 if p_currency is null or p_currency not in ('all','CUP','USD') then raise exception 'Filtro inválido'; end if;
 return coalesce((
 with first_corrections as (
  select distinct on (movement_id) movement_id,previous_entry
  from studio_access_private.treasury_movement_corrections
  where previous_entry->>'fund'=p_fund
  order by movement_id,corrected_at,operation_id
 ), original_entries as (
  select to_jsonb(l) as entry
  from studio_access_private.treasury_ledger l
  where l.fund=p_fund and not exists(select 1 from first_corrections f where f.movement_id=l.id)
  union all
  select previous_entry from first_corrections
 ), events as (
  select (entry->>'id')::uuid as event_id,'created'::text as event_type,
   (entry->>'created_at')::timestamptz as event_at,
   (entry->>'actor')::uuid as actor,null::jsonb as before_entry,entry as after_entry
  from original_entries
  union all
  select operation_id,case when resulting_entry is null then 'deleted' else 'edited' end,
   corrected_at,actor,previous_entry,resulting_entry
  from studio_access_private.treasury_movement_corrections
  where previous_entry->>'fund'=p_fund
 ), filtered as (
  select * from events
  where (p_month is null or ((event_at at time zone 'America/Havana')::date>=date_trunc('month',p_month)::date
   and (event_at at time zone 'America/Havana')::date<(date_trunc('month',p_month)+interval '1 month')::date))
   and (p_currency='all' or before_entry->>'currency'=p_currency or after_entry->>'currency'=p_currency)
   and (coalesce(p_area,'')='' or upper(before_entry->>'area')=upper(p_area) or upper(after_entry->>'area')=upper(p_area))
   and (coalesce(p_search,'')='' or strpos(lower(coalesce(before_entry->>'concept','')),lower(p_search))>0
    or strpos(lower(coalesce(after_entry->>'concept','')),lower(p_search))>0)
  order by event_at desc,event_id desc limit 101 offset greatest(coalesce(p_offset,0),0)
 )
 select jsonb_agg(jsonb_build_object(
  'id',event_id,'action',event_type,'event_at',event_at,
  'event_day',(event_at at time zone 'America/Havana')::date,
  'actor_name',coalesce(
   (select nullif(btrim(e.full_name),'') from public.hr_employees e where e.system_auth_user_id=filtered.actor order by e.full_name limit 1),
   (select left(nullif(btrim(u.raw_user_meta_data->>'username'),''),80) from auth.users u where u.id=filtered.actor)
  ),
  'before',case when before_entry is not null then jsonb_build_object('concept',before_entry->>'concept','date',before_entry->>'occurred_on','area',before_entry->>'area','currency',before_entry->>'currency','amount',before_entry->'amount','source',before_entry->>'source','rate',before_entry->'metadata'->'registration'->>'rate') end,
  'after',case when after_entry is not null then jsonb_build_object('concept',after_entry->>'concept','date',after_entry->>'occurred_on','area',after_entry->>'area','currency',after_entry->>'currency','amount',after_entry->'amount','source',after_entry->>'source','rate',after_entry->'metadata'->'registration'->>'rate') end
 ) order by event_at desc,event_id desc) from filtered
 ),'[]'::jsonb);
end $$;
revoke all on function public.treasury_movement_history(text,integer,date,text,text,text) from public,anon;
grant execute on function public.treasury_movement_history(text,integer,date,text,text,text) to authenticated;
