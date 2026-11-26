-- Cloud backup table: who can read and write it. Run in Supabase: SQL Editor > New query > paste > Run.
-- Safe to run more than once, and safe on an existing table.
--
-- Why this matters: the app asks for "my" row with .eq("user_id", ...), but that filter runs in the browser, so it
-- protects nothing by itself. Only these row-level rules stop one signed-in user from reading another user's
-- backup. The backup is encrypted with the user's own passphrase, but a weak passphrase can be guessed offline
-- if someone gets the ciphertext, so other people must never be able to download it.

create table if not exists public.snapshots (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.snapshots enable row level security;
alter table public.snapshots force row level security;

revoke all on public.snapshots from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.snapshots to authenticated;

drop policy if exists "snapshots select own" on public.snapshots;
create policy "snapshots select own" on public.snapshots
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "snapshots insert own" on public.snapshots;
create policy "snapshots insert own" on public.snapshots
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "snapshots update own" on public.snapshots;
create policy "snapshots update own" on public.snapshots
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "snapshots delete own" on public.snapshots;
create policy "snapshots delete own" on public.snapshots
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------------------
-- CHECK: run this afterwards. Every table should show rls = true, and each policy below must only allow
-- "own" rows (user_id = (select auth.uid())). Any policy with a condition of just "true", or granted to "anon" or "public",
-- lets other people in: drop it with  drop policy "name" on public.<table>;
--
--   select c.relname as table, c.relrowsecurity as rls
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relkind = 'r' order by 1;
--
--   select tablename, policyname, roles, cmd, qual, with_check
--   from pg_policies where schemaname = 'public' order by tablename, policyname;
