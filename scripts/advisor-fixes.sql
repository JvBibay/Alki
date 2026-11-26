-- Fixes for the Supabase "Performance Advisor" warnings. Run AFTER the other scripts (snapshots, push, feedback,
-- testimonials, admin, plans). SQL Editor > New query > paste > Run. Safe to run more than once.
--
-- 1) "Auth RLS Initialization Plan": a policy that says auth.uid() makes Postgres call it again for every row.
--    Written as (select auth.uid()) it is evaluated once per query. Same rule, faster. These policies are
--    re-created below in that form.
-- 2) "Multiple Permissive Policies" on feedback: two SELECT rules for signed-in people (admins, and approved
--    testimonials) are merged into one rule.
-- 3) The same warning on snapshots means an EXTRA policy exists that these scripts didn't create. Run the check at
--    the bottom, and look at what it lists before deleting anything.

-- admins: read yourself
drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins for select to authenticated using (user_id = (select auth.uid()));

-- push devices: see and remove your own
drop policy if exists "push devices select own" on public.push_devices;
create policy "push devices select own" on public.push_devices for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "push devices delete own" on public.push_devices;
create policy "push devices delete own" on public.push_devices for delete to authenticated using (user_id = (select auth.uid()));

-- plans: see your own
drop policy if exists "subscriptions select own" on public.subscriptions;
create policy "subscriptions select own" on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));

-- cloud backup: own row only; saving also needs access (plan, trial or admin)
drop policy if exists "snapshots select own" on public.snapshots;
create policy "snapshots select own" on public.snapshots for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "snapshots insert own" on public.snapshots;
create policy "snapshots insert own" on public.snapshots
  for insert to authenticated with check (user_id = (select auth.uid()) and private.has_access((select auth.uid())));
drop policy if exists "snapshots update own" on public.snapshots;
create policy "snapshots update own" on public.snapshots
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.has_access((select auth.uid())));
drop policy if exists "snapshots delete own" on public.snapshots;
create policy "snapshots delete own" on public.snapshots for delete to authenticated using (user_id = (select auth.uid()));

-- feedback: add as yourself (never pre-approved)
drop policy if exists "feedback insert own" on public.feedback;
create policy "feedback insert own" on public.feedback
  for insert to authenticated with check (user_id = (select auth.uid()) and status = 'new' and approved = false);

-- feedback: ONE read rule per role (signed-in: approved testimonials, or everything if admin; anonymous: approved only)
drop policy if exists "feedback admin read" on public.feedback;
drop policy if exists "feedback public read approved" on public.feedback;
drop policy if exists "feedback read" on public.feedback;
drop policy if exists "feedback read anon" on public.feedback;
create policy "feedback read" on public.feedback
  for select to authenticated using ((approved = true and public_ok = true) or private.is_admin());
create policy "feedback read anon" on public.feedback
  for select to anon using (approved = true and public_ok = true);

-- ---------------------------------------------------------------------------------------------------------------
-- CHECK: every policy on snapshots. Expect exactly four: select, insert, update, delete, all "own".
-- Anything else (a name you don't recognise, a condition of just "true", or a role of anon/public) is an extra rule
-- that lets more people in. Send me the result and I'll tell you which to drop:  drop policy "name" on public.snapshots;
--
--   select policyname, roles, cmd, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'snapshots' order by cmd;
-- ---------------------------------------------------------------------------------------------------------------

-- 4) "Unindexed foreign keys" (suggestion only): lets Postgres find a user's rows fast, and delete an account quickly.
create index if not exists feedback_user_id_idx on public.feedback (user_id);
create index if not exists push_devices_user_id_idx on public.push_devices (user_id);
