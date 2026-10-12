-- Atomic document writes remain compatible with existing devices. Every write
-- updates these real CRM tables in the SAME transaction; reads reconstruct the
-- workspace from the tables. Direct entity writes are deliberately disallowed.
create schema if not exists callflow_private;
revoke all on schema callflow_private from public, anon, authenticated;


create table public.import_batches (
  owner_id uuid not null references public.callflow_workspaces(owner_id) on delete cascade,
  id text not null check (length(id) > 0),
  position bigint not null check (position > 0),
  data jsonb not null check (jsonb_typeof(data) = 'object' and data ? 'id' and data->>'id' = id),
  filename text generated always as (data->>'filename') stored not null,
  imported_count integer generated always as ((data->>'importedCount')::integer) stored not null,
  duplicate_count integer generated always as ((data->>'duplicateCount')::integer) stored not null,
  rejected_count integer generated always as ((data->>'rejectedCount')::integer) stored not null,
  imported_at timestamptz not null,
  primary key (owner_id, id)
);

alter table public.import_batches enable row level security;
revoke all on public.import_batches from public, anon, authenticated;
grant select on public.import_batches to authenticated;
create policy owner_read on public.import_batches for select to authenticated
  using (owner_id = (select auth.uid()) and exists (select 1 from public.callflow_access));

create table public.leads (
  owner_id uuid not null references public.callflow_workspaces(owner_id) on delete cascade,
  id text not null check (length(id) > 0),
  position bigint not null check (position > 0),
  data jsonb not null check (jsonb_typeof(data) = 'object' and data ? 'id' and data->>'id' = id),
  company_name text generated always as (data->>'companyName') stored not null,
  phone text generated always as (data->>'phone') stored,
  normalized_phone text generated always as (data->>'normalizedPhone') stored,
  website text generated always as (data->>'website') stored,
  normalized_domain text generated always as (data->>'normalizedDomain') stored,
  industry text generated always as (data->>'industry') stored,
  city text generated always as (data->>'city') stored,
  contact_name text generated always as (data->>'contactName') stored,
  notes text generated always as (data->>'notes') stored,
  status text generated always as (data->>'status') stored not null,
  import_batch_id text generated always as (data->>'importBatchId') stored,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  check (status in ('Ej kontaktad','Inget svar','Återkom senare','Intresserad','Möte bokat','Inte intresserad','Kund')),
  check (length(company_name) between 1 and 300),
  primary key (owner_id, id)
);

alter table public.leads enable row level security;
revoke all on public.leads from public, anon, authenticated;
grant select on public.leads to authenticated;
create policy owner_read on public.leads for select to authenticated
  using (owner_id = (select auth.uid()) and exists (select 1 from public.callflow_access));

create table public.calling_sessions (
  owner_id uuid not null references public.callflow_workspaces(owner_id) on delete cascade,
  id text not null check (length(id) > 0),
  position bigint not null check (position > 0),
  data jsonb not null check (jsonb_typeof(data) = 'object' and data ? 'id' and data->>'id' = id),
  status text generated always as (data->>'status') stored not null,
  active_duration numeric generated always as ((data->>'activeDuration')::numeric) stored not null,
  current_lead_id text generated always as (data->>'currentLeadId') stored,
  selected_batch text generated always as (data->>'selectedBatch') stored,
  started_at timestamptz not null,
  ended_at timestamptz,
  active_since timestamptz,
  check (status in ('active','paused','ended')),
  check (active_duration >= 0),
  primary key (owner_id, id)
);

alter table public.calling_sessions enable row level security;
revoke all on public.calling_sessions from public, anon, authenticated;
grant select on public.calling_sessions to authenticated;
create policy owner_read on public.calling_sessions for select to authenticated
  using (owner_id = (select auth.uid()) and exists (select 1 from public.callflow_access));

create table public.call_logs (
  owner_id uuid not null references public.callflow_workspaces(owner_id) on delete cascade,
  id text not null check (length(id) > 0),
  position bigint not null check (position > 0),
  data jsonb not null check (jsonb_typeof(data) = 'object' and data ? 'id' and data->>'id' = id),
  lead_id text generated always as (data->>'leadId') stored not null,
  session_id text generated always as (data->>'sessionId') stored,
  outcome text generated always as (data->>'outcome') stored not null,
  notes text generated always as (data->>'notes') stored,
  created_at timestamptz not null,
  meeting_at timestamptz,
  check (outcome in ('Ej kontaktad','Inget svar','Återkom senare','Intresserad','Möte bokat','Inte intresserad','Kund')),
  foreign key (owner_id, lead_id) references public.leads(owner_id, id) on delete cascade,
  primary key (owner_id, id)
);

alter table public.call_logs enable row level security;
revoke all on public.call_logs from public, anon, authenticated;
grant select on public.call_logs to authenticated;
create policy owner_read on public.call_logs for select to authenticated
  using (owner_id = (select auth.uid()) and exists (select 1 from public.callflow_access));

create table public.follow_ups (
  owner_id uuid not null references public.callflow_workspaces(owner_id) on delete cascade,
  id text not null check (length(id) > 0),
  position bigint not null check (position > 0),
  data jsonb not null check (jsonb_typeof(data) = 'object' and data ? 'id' and data->>'id' = id),
  lead_id text generated always as (data->>'leadId') stored not null,
  status text generated always as (data->>'status') stored not null,
  notes text generated always as (data->>'notes') stored,
  source_call_id text generated always as (data->>'sourceCallId') stored,
  due_at timestamptz not null,
  completed_at timestamptz,
  check (status in ('pending','completed')),
  foreign key (owner_id, lead_id) references public.leads(owner_id, id) on delete cascade,
  primary key (owner_id, id)
);

alter table public.follow_ups enable row level security;
revoke all on public.follow_ups from public, anon, authenticated;
grant select on public.follow_ups to authenticated;
create policy owner_read on public.follow_ups for select to authenticated
  using (owner_id = (select auth.uid()) and exists (select 1 from public.callflow_access));

create table public.xp_events (
  owner_id uuid not null references public.callflow_workspaces(owner_id) on delete cascade,
  id text not null check (length(id) > 0),
  position bigint not null check (position > 0),
  data jsonb not null check (jsonb_typeof(data) = 'object' and data ? 'id' and data->>'id' = id),
  source_event_id text generated always as (data->>'sourceEventId') stored not null,
  event_type text generated always as (data->>'type') stored not null,
  points integer generated always as ((data->>'points')::integer) stored not null,
  created_at timestamptz not null,
  check (event_type in ('call','followup','meeting','customer')),
  check (points >= 0),
  primary key (owner_id, id)
);

alter table public.xp_events enable row level security;
revoke all on public.xp_events from public, anon, authenticated;
grant select on public.xp_events to authenticated;
create policy owner_read on public.xp_events for select to authenticated
  using (owner_id = (select auth.uid()) and exists (select 1 from public.callflow_access));

create table public.goal_settings (
 owner_id uuid primary key references public.callflow_workspaces(owner_id) on delete cascade,
 data jsonb not null check (jsonb_typeof(data) = 'object'),
 daily_call_target integer generated always as ((data->>'dailyCallTarget')::integer) stored not null check (daily_call_target > 0),
 weekly_call_target integer generated always as ((data->>'weeklyCallTarget')::integer) stored not null check (weekly_call_target > 0),
 weekly_meeting_target integer generated always as ((data->>'weeklyMeetingTarget')::integer) stored not null check (weekly_meeting_target > 0),
 weekly_follow_up_target integer generated always as ((data->>'weeklyFollowUpTarget')::integer) stored not null check (weekly_follow_up_target > 0),
 weekly_customer_target integer generated always as ((data->>'weeklyCustomerTarget')::integer) stored not null check (weekly_customer_target > 0),
 theme text generated always as (data->>'theme') stored not null check (theme in ('light','dark','system'))
);
alter table public.goal_settings enable row level security;
revoke all on public.goal_settings from public, anon, authenticated;
grant select on public.goal_settings to authenticated;
create policy owner_read on public.goal_settings for select to authenticated
 using (owner_id = (select auth.uid()) and exists (select 1 from public.callflow_access));
create index leads_status_idx on public.leads(owner_id, status);
create index leads_phone_idx on public.leads(owner_id, normalized_phone);
create index leads_domain_idx on public.leads(owner_id, normalized_domain);
create index leads_follow_up_idx on public.leads(owner_id, next_follow_up_at);
create index call_logs_lead_idx on public.call_logs(owner_id, lead_id, created_at);
create index call_logs_session_idx on public.call_logs(owner_id, session_id);
create index follow_ups_lead_idx on public.follow_ups(owner_id, lead_id);
create index follow_ups_due_idx on public.follow_ups(owner_id, status, due_at);
create index xp_source_idx on public.xp_events(owner_id, source_event_id);


insert into public.import_batches (owner_id, id, position, data, imported_at) select w.owner_id, e.value->>'id', e.ordinality, e.value, (e.value->>'importedAt')::timestamptz from public.callflow_workspaces w cross join lateral jsonb_array_elements(w.document->'batches') with ordinality e(value, ordinality);

insert into public.leads (owner_id, id, position, data, created_at, updated_at, last_contacted_at, next_follow_up_at) select w.owner_id, e.value->>'id', e.ordinality, e.value, (e.value->>'createdAt')::timestamptz, (e.value->>'updatedAt')::timestamptz, (e.value->>'lastContactedAt')::timestamptz, (e.value->>'nextFollowUpAt')::timestamptz from public.callflow_workspaces w cross join lateral jsonb_array_elements(w.document->'leads') with ordinality e(value, ordinality);

insert into public.calling_sessions (owner_id, id, position, data, started_at, ended_at, active_since) select w.owner_id, e.value->>'id', e.ordinality, e.value, (e.value->>'startedAt')::timestamptz, (e.value->>'endedAt')::timestamptz, (e.value->>'activeSince')::timestamptz from public.callflow_workspaces w cross join lateral jsonb_array_elements(w.document->'sessions') with ordinality e(value, ordinality);

insert into public.call_logs (owner_id, id, position, data, created_at, meeting_at) select w.owner_id, e.value->>'id', e.ordinality, e.value, (e.value->>'createdAt')::timestamptz, (e.value->>'meetingAt')::timestamptz from public.callflow_workspaces w cross join lateral jsonb_array_elements(w.document->'calls') with ordinality e(value, ordinality);

insert into public.follow_ups (owner_id, id, position, data, due_at, completed_at) select w.owner_id, e.value->>'id', e.ordinality, e.value, (e.value->>'dueAt')::timestamptz, (e.value->>'completedAt')::timestamptz from public.callflow_workspaces w cross join lateral jsonb_array_elements(w.document->'followUps') with ordinality e(value, ordinality);

insert into public.xp_events (owner_id, id, position, data, created_at) select w.owner_id, e.value->>'id', e.ordinality, e.value, (e.value->>'createdAt')::timestamptz from public.callflow_workspaces w cross join lateral jsonb_array_elements(w.document->'xp') with ordinality e(value, ordinality);

insert into public.goal_settings(owner_id, data) select owner_id, document->'settings' from public.callflow_workspaces;

-- This private trigger needs definer rights to maintain read-only entity tables.
-- It cannot be called as an RPC, grants no EXECUTE to clients, and is only attached
-- to the workspace table, whose owner/email checks and revision checks stay active.
create function callflow_private.sync_crm() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is not null and (new.owner_id <> auth.uid() or not exists (
   select 1 from public.callflow_access a where a.email = lower(auth.jwt()->>'email')
 )) then
   raise exception 'CALLFLOW_ACCESS_DENIED' using errcode = '42501';
 end if;


 insert into public.import_batches (owner_id, id, position, data, imported_at) select new.owner_id, e.value->>'id', e.ordinality, e.value, (e.value->>'importedAt')::timestamptz from jsonb_array_elements(new.document->'batches') with ordinality e(value, ordinality) on conflict (owner_id,id) do update set position = excluded.position, data = excluded.data, imported_at = excluded.imported_at where (import_batches.position, import_batches.data) is distinct from (excluded.position, excluded.data);

 insert into public.leads (owner_id, id, position, data, created_at, updated_at, last_contacted_at, next_follow_up_at) select new.owner_id, e.value->>'id', e.ordinality, e.value, (e.value->>'createdAt')::timestamptz, (e.value->>'updatedAt')::timestamptz, (e.value->>'lastContactedAt')::timestamptz, (e.value->>'nextFollowUpAt')::timestamptz from jsonb_array_elements(new.document->'leads') with ordinality e(value, ordinality) on conflict (owner_id,id) do update set position = excluded.position, data = excluded.data, created_at = excluded.created_at, updated_at = excluded.updated_at, last_contacted_at = excluded.last_contacted_at, next_follow_up_at = excluded.next_follow_up_at where (leads.position, leads.data) is distinct from (excluded.position, excluded.data);

 insert into public.calling_sessions (owner_id, id, position, data, started_at, ended_at, active_since) select new.owner_id, e.value->>'id', e.ordinality, e.value, (e.value->>'startedAt')::timestamptz, (e.value->>'endedAt')::timestamptz, (e.value->>'activeSince')::timestamptz from jsonb_array_elements(new.document->'sessions') with ordinality e(value, ordinality) on conflict (owner_id,id) do update set position = excluded.position, data = excluded.data, started_at = excluded.started_at, ended_at = excluded.ended_at, active_since = excluded.active_since where (calling_sessions.position, calling_sessions.data) is distinct from (excluded.position, excluded.data);

 insert into public.call_logs (owner_id, id, position, data, created_at, meeting_at) select new.owner_id, e.value->>'id', e.ordinality, e.value, (e.value->>'createdAt')::timestamptz, (e.value->>'meetingAt')::timestamptz from jsonb_array_elements(new.document->'calls') with ordinality e(value, ordinality) on conflict (owner_id,id) do update set position = excluded.position, data = excluded.data, created_at = excluded.created_at, meeting_at = excluded.meeting_at where (call_logs.position, call_logs.data) is distinct from (excluded.position, excluded.data);

 insert into public.follow_ups (owner_id, id, position, data, due_at, completed_at) select new.owner_id, e.value->>'id', e.ordinality, e.value, (e.value->>'dueAt')::timestamptz, (e.value->>'completedAt')::timestamptz from jsonb_array_elements(new.document->'followUps') with ordinality e(value, ordinality) on conflict (owner_id,id) do update set position = excluded.position, data = excluded.data, due_at = excluded.due_at, completed_at = excluded.completed_at where (follow_ups.position, follow_ups.data) is distinct from (excluded.position, excluded.data);

 insert into public.xp_events (owner_id, id, position, data, created_at) select new.owner_id, e.value->>'id', e.ordinality, e.value, (e.value->>'createdAt')::timestamptz from jsonb_array_elements(new.document->'xp') with ordinality e(value, ordinality) on conflict (owner_id,id) do update set position = excluded.position, data = excluded.data, created_at = excluded.created_at where (xp_events.position, xp_events.data) is distinct from (excluded.position, excluded.data);

 delete from public.xp_events t where t.owner_id = new.owner_id and not exists (select 1 from jsonb_array_elements(new.document->'xp') e where e->>'id' = t.id);

 delete from public.follow_ups t where t.owner_id = new.owner_id and not exists (select 1 from jsonb_array_elements(new.document->'followUps') e where e->>'id' = t.id);

 delete from public.call_logs t where t.owner_id = new.owner_id and not exists (select 1 from jsonb_array_elements(new.document->'calls') e where e->>'id' = t.id);

 delete from public.calling_sessions t where t.owner_id = new.owner_id and not exists (select 1 from jsonb_array_elements(new.document->'sessions') e where e->>'id' = t.id);

 delete from public.leads t where t.owner_id = new.owner_id and not exists (select 1 from jsonb_array_elements(new.document->'leads') e where e->>'id' = t.id);

 delete from public.import_batches t where t.owner_id = new.owner_id and not exists (select 1 from jsonb_array_elements(new.document->'batches') e where e->>'id' = t.id);

 insert into public.goal_settings(owner_id,data) values(new.owner_id,new.document->'settings') on conflict(owner_id) do update set data = excluded.data where goal_settings.data is distinct from excluded.data;
 return new;
end;
$$;
revoke all on function callflow_private.sync_crm() from public, anon, authenticated;
create trigger callflow_sync_crm after insert or update of document on public.callflow_workspaces
 for each row execute function callflow_private.sync_crm();


-- SECURITY INVOKER keeps the same owner-only RLS for the entire read.
create function public.callflow_read_workspace() returns table(document jsonb, revision bigint)
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
 'version', 1,
 'batches', coalesce((select jsonb_agg(t.data order by t.position) from public.import_batches t where t.owner_id = w.owner_id), '[]'::jsonb),
 'leads', coalesce((select jsonb_agg(t.data order by t.position) from public.leads t where t.owner_id = w.owner_id), '[]'::jsonb),
 'sessions', coalesce((select jsonb_agg(t.data order by t.position) from public.calling_sessions t where t.owner_id = w.owner_id), '[]'::jsonb),
 'calls', coalesce((select jsonb_agg(t.data order by t.position) from public.call_logs t where t.owner_id = w.owner_id), '[]'::jsonb),
 'followUps', coalesce((select jsonb_agg(t.data order by t.position) from public.follow_ups t where t.owner_id = w.owner_id), '[]'::jsonb),
 'xp', coalesce((select jsonb_agg(t.data order by t.position) from public.xp_events t where t.owner_id = w.owner_id), '[]'::jsonb),
 'settings', (select t.data from public.goal_settings t where t.owner_id = w.owner_id)
 ), w.revision from public.callflow_workspaces w where w.owner_id = (select auth.uid());
$$;
revoke all on function public.callflow_read_workspace() from public, anon, authenticated;
grant execute on function public.callflow_read_workspace() to authenticated;
comment on table public.callflow_workspaces is 'Atomic write envelope and recovery snapshot; entity tables are updated in the same transaction. Use the app for edits.';
