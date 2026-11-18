-- The API credential is provisioned separately in Vault, never in this migration.
alter table public.dashboard_exchange_rate_cache
  add column if not exists source_date text,
  add column if not exists source_time text,
  add column if not exists refresh_after timestamptz not null default '-infinity';

create or replace function public.eltoque_server_token() returns text
language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'eltoque_api_token' limit 1;
$$;
revoke all on function public.eltoque_server_token() from public, anon, authenticated;
grant execute on function public.eltoque_server_token() to service_role;

-- A short shared lease prevents simultaneous cold starts exhausting the API quota.
create or replace function public.eltoque_claim_refresh() returns boolean
language plpgsql security definer set search_path = '' as $$
declare claimed text;
begin
  insert into public.dashboard_exchange_rate_cache(id,rates,source_url,fetched_at)
    values ('eltoque-informal','{}','https://tasas.eltoque.com/v1/trmi','1970-01-01')
    on conflict (id) do nothing;
  update public.dashboard_exchange_rate_cache set refresh_after = now() + interval '30 seconds'
    where id = 'eltoque-informal' and refresh_after <= now() returning id into claimed;
  return claimed is not null;
end;
$$;
revoke all on function public.eltoque_claim_refresh() from public, anon, authenticated;
grant execute on function public.eltoque_claim_refresh() to service_role;
