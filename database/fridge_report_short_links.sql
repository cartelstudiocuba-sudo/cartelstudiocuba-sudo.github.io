create table if not exists public.fridge_report_short_links(
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
 object_path text not null,filename text not null,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),expires_at timestamptz not null);
alter table public.fridge_report_short_links enable row level security;
revoke all on public.fridge_report_short_links from public,anon,authenticated;
grant select,insert,delete on public.fridge_report_short_links to service_role;
