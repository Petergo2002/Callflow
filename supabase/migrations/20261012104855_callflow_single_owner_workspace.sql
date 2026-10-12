-- CALLFLOW uses one atomic document for the solo workspace. No anonymous access.
create table public.callflow_access (
  singleton boolean primary key default true check (singleton),
  email text not null unique check (email = lower(trim(email)))
);
alter table public.callflow_access enable row level security;
revoke all on public.callflow_access from public, anon, authenticated;
grant select on public.callflow_access to authenticated;
create policy callflow_owner_access on public.callflow_access
  for select to authenticated
  using ((select auth.uid()) is not null and email = lower((select auth.jwt() ->> 'email')));

create table public.callflow_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null,
  revision bigint not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now(),
  constraint callflow_document_shape check (
    jsonb_typeof(document) = 'object' and document @> '{"version":1}'::jsonb
    and jsonb_typeof(document -> 'leads') = 'array'
    and jsonb_typeof(document -> 'calls') = 'array'
    and jsonb_typeof(document -> 'followUps') = 'array'
    and jsonb_typeof(document -> 'sessions') = 'array'
    and jsonb_typeof(document -> 'batches') = 'array'
    and jsonb_typeof(document -> 'xp') = 'array'
    and jsonb_typeof(document -> 'settings') = 'object'
    and document ?& array['version','leads','calls','followUps','sessions','batches','xp','settings']
  ),
  constraint callflow_document_size check (octet_length(document::text) <= 20971520)
);
alter table public.callflow_workspaces enable row level security;
revoke all on public.callflow_workspaces from public, anon, authenticated;
grant select, insert, update on public.callflow_workspaces to authenticated;
create policy callflow_read on public.callflow_workspaces for select to authenticated
  using (owner_id = (select auth.uid()) and exists (select 1 from public.callflow_access));
create policy callflow_create on public.callflow_workspaces for insert to authenticated
  with check (owner_id = (select auth.uid()) and revision = 1 and exists (select 1 from public.callflow_access));
create policy callflow_update on public.callflow_workspaces for update to authenticated
  using (owner_id = (select auth.uid()) and exists (select 1 from public.callflow_access))
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.callflow_access));

create function public.callflow_check_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.owner_id <> old.owner_id or new.revision <> old.revision + 1 then
    raise exception 'CALLFLOW_REVISION_INVALID' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.callflow_check_revision() from public, anon, authenticated;
create trigger callflow_workspace_revision before update on public.callflow_workspaces
  for each row execute function public.callflow_check_revision();
