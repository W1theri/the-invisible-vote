-- Run once in the SQL Editor of a NEW Supabase project.
-- Only this project's iv_* objects are created; no credentials are embedded.
begin;

create schema if not exists iv_private;
revoke all on schema iv_private from public, anon, authenticated;

create table if not exists iv_private.study (
  id integer primary key check (id = 1),
  assigned_a integer not null default 0 check (assigned_a >= 0),
  assigned_b integer not null default 0 check (assigned_b >= 0),
  is_open boolean not null default true
);
insert into iv_private.study(id) values (1) on conflict do nothing;

create table if not exists iv_private.researchers (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists iv_private.sessions (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  public_id uuid not null unique default gen_random_uuid(),
  experiment_group text not null check (experiment_group in ('A','B')),
  language text not null check (language in ('en','ru')),
  status text not null default 'assigned' check (status in ('assigned','voted','complete','withdrawn')),
  selected_option text check (selected_option in ('library','lounge')),
  awareness text check (awareness in ('yes','no','unsure')),
  confidence integer check (confidence between 1 and 5),
  reason text not null default '' check (char_length(reason) <= 500),
  constraint consistent_stage check (
    (status in ('assigned','withdrawn') and selected_option is null and awareness is null and confidence is null and reason = '')
    or (status = 'voted' and selected_option is not null and awareness is null and confidence is null and reason = '')
    or (status = 'complete' and selected_option is not null and awareness is not null and confidence is not null)
  )
);

alter table iv_private.study enable row level security;
alter table iv_private.researchers enable row level security;
alter table iv_private.sessions enable row level security;
revoke all on all tables in schema iv_private from public, anon, authenticated;
-- No direct browser table policies. Narrow security-definer RPCs are the only path.

create or replace function public.iv_is_researcher()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((auth.jwt()->>'is_anonymous')::boolean, true) = false
    and exists(select 1 from iv_private.researchers r where r.user_id = auth.uid());
$$;

create or replace function iv_private.session_json(s iv_private.sessions)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'id', s.public_id::text, 'group', s.experiment_group,
    'stage', case s.status when 'assigned' then 'vote' when 'voted' then 'survey' when 'complete' then 'reveal' else 'withdrawn' end,
    'option', s.selected_option, 'awareness', s.awareness, 'confidence', s.confidence,
    'reason', s.reason, 'language', s.language
  );
$$;

create or replace function public.iv_session()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s iv_private.sessions;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into s from iv_private.sessions where owner_id = auth.uid();
  if not found then return null; end if;
  return iv_private.session_json(s);
end;
$$;

create or replace function public.iv_start(p_language text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s iv_private.sessions; st iv_private.study; chosen text;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false then
    raise exception 'ANONYMOUS_PARTICIPANT_REQUIRED' using errcode = '42501';
  end if;
  if p_language is null or p_language not in ('en','ru') then raise exception 'INVALID_LANGUAGE' using errcode = '22023'; end if;
  -- Serializes concurrent starts, including two tabs with the same owner.
  select * into st from iv_private.study where id = 1 for update;
  select * into s from iv_private.sessions where owner_id = auth.uid();
  if found then return iv_private.session_json(s); end if;
  if not st.is_open then raise exception 'STUDY_CLOSED' using errcode = 'P0001'; end if;
  if st.assigned_a + st.assigned_b >= 10000 then raise exception 'STUDY_CAPACITY' using errcode = 'P0001'; end if;
  chosen := case when st.assigned_a < st.assigned_b then 'A'
    when st.assigned_b < st.assigned_a then 'B'
    when pg_catalog.random() < 0.5 then 'A' else 'B' end;
  insert into iv_private.sessions(owner_id,experiment_group,language)
    values (auth.uid(),chosen,p_language) returning * into s;
  update iv_private.study set assigned_a = assigned_a + case when chosen = 'A' then 1 else 0 end,
    assigned_b = assigned_b + case when chosen = 'B' then 1 else 0 end where id = 1;
  return iv_private.session_json(s);
end;
$$;

create or replace function public.iv_choose(p_option text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s iv_private.sessions;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_option is null or p_option not in ('library','lounge') then raise exception 'INVALID_OPTION' using errcode = '22023'; end if;
  select * into s from iv_private.sessions where owner_id = auth.uid() for update;
  if not found then raise exception 'SESSION_REQUIRED' using errcode = 'P0001'; end if;
  if s.status in ('voted','complete') and s.selected_option = p_option then return iv_private.session_json(s); end if;
  if s.status <> 'assigned' then raise exception 'VOTE_LOCKED' using errcode = 'P0001'; end if;
  update iv_private.sessions set status = 'voted',selected_option = p_option where owner_id = auth.uid() returning * into s;
  return iv_private.session_json(s);
end;
$$;

create or replace function public.iv_complete(p_awareness text,p_confidence integer,p_reason text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s iv_private.sessions;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if p_awareness is null or p_awareness not in ('yes','no','unsure') or p_confidence is null
    or p_confidence not between 1 and 5 or p_reason is null or char_length(p_reason) > 500 then
    raise exception 'INVALID_SURVEY' using errcode = '22023';
  end if;
  select * into s from iv_private.sessions where owner_id = auth.uid() for update;
  if not found then raise exception 'SESSION_REQUIRED' using errcode = 'P0001'; end if;
  if s.status = 'complete' then return iv_private.session_json(s); end if;
  if s.status <> 'voted' then raise exception 'VOTE_REQUIRED' using errcode = 'P0001'; end if;
  update iv_private.sessions set status = 'complete',awareness = p_awareness,confidence = p_confidence,reason = p_reason
    where owner_id = auth.uid() returning * into s;
  return iv_private.session_json(s);
end;
$$;

create or replace function public.iv_withdraw()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s iv_private.sessions;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  update iv_private.sessions set status = 'withdrawn',selected_option = null,awareness = null,confidence = null,reason = ''
    where owner_id = auth.uid() returning * into s;
  if not found then raise exception 'SESSION_REQUIRED' using errcode = 'P0001'; end if;
  -- Only an assignment marker remains, preventing another vote under this identity.
  return iv_private.session_json(s);
end;
$$;

create or replace function public.iv_admin_snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.iv_is_researcher() then raise exception 'RESEARCHER_REQUIRED' using errcode = '42501'; end if;
  select jsonb_build_object('version',1,'rows',coalesce((
    select jsonb_agg(jsonb_build_object('id',s.public_id::text,'group',s.experiment_group,
      'option',s.selected_option,'status',case when s.status='voted' then 'pending' else 'complete' end,
      'synthetic',false,'awareness',s.awareness,'confidence',s.confidence,'reason',s.reason)
      order by s.public_id)
    from iv_private.sessions s where s.status in ('voted','complete')
  ),'[]'::jsonb),'assignments',jsonb_build_object('A',st.assigned_a,'B',st.assigned_b),
    'isOpen',st.is_open)
  into result from iv_private.study st where st.id = 1;
  return result;
end;
$$;

create or replace function public.iv_admin_set_open(p_open boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.iv_is_researcher() then raise exception 'RESEARCHER_REQUIRED' using errcode = '42501'; end if;
  if p_open is null then raise exception 'INVALID_STATUS' using errcode = '22023'; end if;
  update iv_private.study set is_open = p_open where id = 1;
  return p_open;
end;
$$;

create or replace function public.iv_admin_clear(p_confirmation text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.iv_is_researcher() then raise exception 'RESEARCHER_REQUIRED' using errcode = '42501'; end if;
  if p_confirmation is distinct from 'DELETE REAL RESPONSES' then raise exception 'CONFIRMATION_REQUIRED' using errcode = '22023'; end if;
  -- Same lock ordering as iv_start; no race between clearing and assigning.
  perform 1 from iv_private.study where id = 1 for update;
  delete from iv_private.sessions;
  update iv_private.study set assigned_a = 0,assigned_b = 0,is_open = false where id = 1;
end;
$$;

revoke all on all functions in schema iv_private from public, anon, authenticated;
-- PostgreSQL grants new functions to PUBLIC by default. Close only our own RPCs.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'iv_is_researcher','iv_session','iv_start','iv_choose','iv_complete','iv_withdraw',
      'iv_admin_snapshot','iv_admin_set_open','iv_admin_clear')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
    execute format('grant execute on function %s to authenticated', f.signature);
  end loop;
end;
$$;
commit;
