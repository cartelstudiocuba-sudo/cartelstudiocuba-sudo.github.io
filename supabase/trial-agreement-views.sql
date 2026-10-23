-- Candidate links are capabilities for one immutable document, never candidate IDs.
create table public.hr_trial_agreement_links (
 id uuid primary key default gen_random_uuid(),
 trial_id uuid not null references public.hr_trial_periods(id) on delete cascade,
 token_hash text not null unique,
 document jsonb not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '180 days',
 revoked_at timestamptz
);
alter table public.hr_trial_agreement_links enable row level security;
revoke all on public.hr_trial_agreement_links from public, anon, authenticated;
grant select, insert on public.hr_trial_agreement_links to authenticated;
create policy owner_documents on public.hr_trial_agreement_links to authenticated
 using ((select studio_access_private.is_owner()))
 with check ((select studio_access_private.is_owner()));

-- Close the old ID-only public endpoint. RLS continues to protect admin reads.
alter function public.get_hr_trial_agreement_public(uuid) security invoker;
revoke execute on function public.get_hr_trial_agreement_public(uuid) from public, anon;
grant execute on function public.get_hr_trial_agreement_public(uuid) to authenticated;

create function public.hr_trial_agreement_preview(p_candidate uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v jsonb; saved jsonb;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then
  raise exception 'No autorizado' using errcode='42501';
 end if;
 v := public.get_hr_trial_agreement_public(p_candidate);
 select l.document into saved from public.hr_trial_agreement_links l
 join public.hr_trial_periods t on t.id=l.trial_id
 where t.candidate_id=p_candidate order by l.created_at desc, l.id desc limit 1;
 if saved is not null then
  return saved || jsonb_build_object('hr_candidates',v->'hr_candidates');
 end if;
 return v;
end $$;
revoke all on function public.hr_trial_agreement_preview(uuid) from public, anon;
grant execute on function public.hr_trial_agreement_preview(uuid) to authenticated;

create function public.hr_prepare_trial_agreement(p_candidate uuid,p_representative jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v jsonb; token text; link text; tid uuid; rep jsonb;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then
  raise exception 'No autorizado' using errcode='42501';
 end if;
 if length(trim(p_representative->>'name')) not between 1 and 200
 or coalesce(p_representative->>'ci','') !~ '^[0-9]{11}$'
 or length(trim(p_representative->>'address')) not between 1 and 1000
 or p_representative->>'name' is null or p_representative->>'address' is null then
  raise exception 'Completa los datos del representante';
 end if;
 select id into tid from public.hr_trial_periods where candidate_id=p_candidate for update;
 if tid is null then raise exception 'No se encontró el período de prueba'; end if;
 v := public.get_hr_trial_agreement_public(p_candidate);
 rep := jsonb_build_object('name',trim(p_representative->>'name'),'ci',p_representative->>'ci','address',trim(p_representative->>'address'));
 -- Explicit allowlist: no IDs, phone, internal notes, or recruitment status.
 v := jsonb_build_object('role_title',v->'role_title','start_date',v->'start_date',
 'duration_days',v->'duration_days','schedule',v->'schedule','compensation',v->'compensation',
 'location',v->'location','hr_candidates',jsonb_build_object('full_name',v#>'{hr_candidates,full_name}'),
 'representative',rep);
 token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
 insert into public.hr_trial_agreement_links(trial_id,token_hash,document)
 values(tid,encode(sha256(convert_to(token,'UTF8')),'hex'),v);
 link := 'https://gestion.elcartelstudio.com/acuerdo-periodo-prueba.html#token=' || token;
 update public.hr_trial_periods set agreement_url=link,updated_at=now() where id=tid;
 return jsonb_build_object('candidate_url',link);
end $$;
revoke all on function public.hr_prepare_trial_agreement(uuid,jsonb) from public, anon;
grant execute on function public.hr_prepare_trial_agreement(uuid,jsonb) to authenticated;

-- Deliberate public, read-only capability endpoint. No table grants to anon.
create function public.hr_read_trial_agreement(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
 select document from public.hr_trial_agreement_links
 where length(p_token)=64 and p_token ~ '^[0-9a-f]{64}$'
 and token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
 and revoked_at is null and expires_at>now();
$$;
revoke all on function public.hr_read_trial_agreement(text) from public;
grant execute on function public.hr_read_trial_agreement(text) to anon, authenticated;
comment on function public.hr_read_trial_agreement(text) is
 'Intentional public capability reader: SHA-256 of 64 hex random token; returns only one contract snapshot. No administrative operations.';
