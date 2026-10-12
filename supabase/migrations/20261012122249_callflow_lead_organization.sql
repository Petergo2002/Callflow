-- User-defined groups and source/date metadata, preserving existing leads.
create table public.lead_groups (
 owner_id uuid not null references public.callflow_workspaces(owner_id) on delete cascade,
 id text not null check(length(id)>0),
 position bigint not null check(position>0),
 data jsonb not null check(jsonb_typeof(data)='object' and data ? 'id' and data->>'id'=id),
 name text generated always as (data->>'name') stored not null check(length(name) between 1 and 80),
 color text generated always as (data->>'color') stored not null check(color in ('#16724c','#3568b0','#8b5db8','#c47b29','#b94f68','#64748b')),
 created_at timestamptz not null,
 primary key(owner_id,id)
);
alter table public.lead_groups enable row level security;
revoke all on public.lead_groups from public, anon, authenticated;
grant select on public.lead_groups to authenticated;
create policy owner_read on public.lead_groups for select to authenticated
 using(owner_id=(select auth.uid()) and exists(select 1 from public.callflow_access));
insert into public.lead_groups(owner_id,id,position,data,created_at)
 select w.owner_id,e.value->>'id',e.ordinality,e.value,(e.value->>'createdAt')::timestamptz
 from public.callflow_workspaces w cross join lateral jsonb_array_elements(coalesce(w.document->'groups','[]'::jsonb)) with ordinality e(value,ordinality);
alter table public.leads
 add column source text generated always as (data->>'source') stored,
 add column group_id text generated always as (nullif(data->>'groupId','')) stored,
 add column imported_at timestamptz,
 add constraint leads_group_fkey foreign key(owner_id,group_id) references public.lead_groups(owner_id,id);
alter table public.import_batches
 add column source text generated always as (data->>'source') stored;
-- This is a column backfill only; workspace documents and revisions are untouched.
update public.leads l set imported_at=coalesce((l.data->>'importedAt')::timestamptz,
 (select b.imported_at from public.import_batches b where b.owner_id=l.owner_id and b.id=l.import_batch_id));
create index leads_group_idx on public.leads(owner_id,group_id);
create index leads_source_idx on public.leads(owner_id,source);
create index leads_imported_idx on public.leads(owner_id,imported_at);
create or replace function callflow_private.sync_crm() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is not null and (new.owner_id <> auth.uid() or not exists (
   select 1 from public.callflow_access a where a.email = lower(auth.jwt()->>'email')
 )) then
   raise exception 'CALLFLOW_ACCESS_DENIED' using errcode = '42501';
 end if;


 if new.document ? 'groups' then
   insert into public.lead_groups(owner_id,id,position,data,created_at)
     select new.owner_id, e.value->>'id', e.ordinality, e.value, (e.value->>'createdAt')::timestamptz
     from jsonb_array_elements(new.document->'groups') with ordinality e(value,ordinality)
     on conflict(owner_id,id) do update set position=excluded.position,data=excluded.data,created_at=excluded.created_at
     where (lead_groups.position,lead_groups.data) is distinct from (excluded.position,excluded.data);
 end if;
 insert into public.import_batches (owner_id, id, position, data, imported_at) select new.owner_id, e.value->>'id', e.ordinality, e.value, (e.value->>'importedAt')::timestamptz from jsonb_array_elements(new.document->'batches') with ordinality e(value, ordinality) on conflict (owner_id,id) do update set position = excluded.position, data = excluded.data, imported_at = excluded.imported_at where (import_batches.position, import_batches.data) is distinct from (excluded.position, excluded.data);

 insert into public.leads (owner_id, id, position, data, created_at, updated_at, last_contacted_at, next_follow_up_at, imported_at) select new.owner_id, e.value->>'id', e.ordinality, e.value, (e.value->>'createdAt')::timestamptz, (e.value->>'updatedAt')::timestamptz, (e.value->>'lastContactedAt')::timestamptz, (e.value->>'nextFollowUpAt')::timestamptz, coalesce((e.value->>'importedAt')::timestamptz, (select b.imported_at from public.import_batches b where b.owner_id=new.owner_id and b.id=e.value->>'importBatchId')) from jsonb_array_elements(new.document->'leads') with ordinality e(value, ordinality) on conflict (owner_id,id) do update set position = excluded.position, data = excluded.data, created_at = excluded.created_at, updated_at = excluded.updated_at, last_contacted_at = excluded.last_contacted_at, next_follow_up_at = excluded.next_follow_up_at, imported_at = excluded.imported_at where (leads.position, leads.data) is distinct from (excluded.position, excluded.data);

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
 if new.document ? 'groups' then
   delete from public.lead_groups g where g.owner_id=new.owner_id and not exists
     (select 1 from jsonb_array_elements(new.document->'groups') e where e->>'id'=g.id);
 end if;
 return new;
end;
$$;
revoke all on function callflow_private.sync_crm() from public, anon, authenticated;
create or replace function public.callflow_read_workspace() returns table(document jsonb, revision bigint)
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
 'version', 1,
 'groups', coalesce((select jsonb_agg(t.data order by t.position) from public.lead_groups t where t.owner_id=w.owner_id),'[]'::jsonb),
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
