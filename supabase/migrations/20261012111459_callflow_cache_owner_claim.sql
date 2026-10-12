-- Evaluate the verified email claim once per statement, including the owner lookup.
alter policy callflow_owner_access on public.callflow_access
  using ((select auth.uid()) is not null and email = lower((select auth.jwt()) ->> 'email'));
