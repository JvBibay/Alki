-- Subscription plans (monthly, annual, lifetime). Run once in Supabase (after admin.sql, snapshots.sql and limits.sql):
-- SQL Editor > New query > paste > Run. Safe to run more than once.
--
-- TRIAL: every new account gets 7 days of full access, counted from when the account was created (once per account).
--
-- FREE for everyone: all local tracking, receipts, reminders, backups to a file, restoring or deleting an existing cloud backup.
-- PAID: saving (backing up / auto-syncing) to the cloud. Admin accounts are exempt and always have access.
-- The rule is enforced here in the database, so it can't be bypassed from the browser.

create table if not exists public.subscriptions (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  plan               text not null check (plan in ('monthly', 'annual', 'lifetime')),
  -- When paid access ends. NULL means never (lifetime). Renewals push this date forward.
  current_period_end timestamptz,
  provider           text check (char_length(provider) <= 30),
  provider_ref       text check (char_length(provider_ref) <= 120),
  updated_at         timestamptz not null default now(),
  check (plan = 'lifetime' or current_period_end is not null)
);

alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;
revoke all on public.subscriptions from anon;
grant usage on schema public to authenticated;
-- People can only SEE their own plan. Nobody can write it from the app: only the payment webhook (service role)
-- or an admin (functions below) can, so no one can give themselves a plan.
grant select on public.subscriptions to authenticated;
drop policy if exists "subscriptions select own" on public.subscriptions;
create policy "subscriptions select own" on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.subscriptions to service_role;

-- Does this account have full access right now? Admins always do, so does anyone in their first 7 days,
-- and anyone with a plan that hasn't ended.
create or replace function private.has_access(uid uuid) returns boolean
language sql security definer stable set search_path = public, auth as $$
  select exists (select 1 from public.admins where user_id = uid)
      or exists (select 1 from public.subscriptions where user_id = uid and (plan = 'lifetime' or current_period_end > now()))
      or exists (select 1 from auth.users where id = uid and created_at > now() - interval '7 days')
$$;
revoke all on function private.has_access(uuid) from public, anon;
grant execute on function private.has_access(uuid) to authenticated;

-- What the app shows: am I active, which plan, until when (the plan's end, or the trial's end), am I an admin, am I on the trial.
-- (Dropped first because the columns changed since the first version.)
drop function if exists public.my_access();
create or replace function public.my_access() returns table (active boolean, plan text, until timestamptz, is_admin boolean, trial boolean)
language sql security definer stable set search_path = public, auth as $$
  with me as (
    select u.id as uid,
           u.created_at + interval '7 days' as trial_end,
           exists (select 1 from public.admins a where a.user_id = u.id) as adm,
           coalesce(s.plan = 'lifetime' or s.current_period_end > now(), false) as paid
    from auth.users u
    left join public.subscriptions s on s.user_id = u.id
    where u.id = auth.uid()
  )
  select private.has_access(me.uid),
         s.plan,
         case when me.paid then s.current_period_end
              when me.trial_end > now() and not me.adm then me.trial_end
              else s.current_period_end end,
         me.adm,
         (not me.paid and not me.adm and me.trial_end > now())
  from me
  left join public.subscriptions s on s.user_id = me.uid
$$;
revoke all on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

-- Saving a cloud backup now needs access. Reading, restoring and deleting stay free (nobody's data is held hostage).
drop policy if exists "snapshots insert own" on public.snapshots;
create policy "snapshots insert own" on public.snapshots
  for insert to authenticated with check (user_id = (select auth.uid()) and private.has_access((select auth.uid())));

drop policy if exists "snapshots update own" on public.snapshots;
create policy "snapshots update own" on public.snapshots
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and private.has_access((select auth.uid())));

-- Who gave or removed which plan, and when: a record for refunds, disputes and your own books. Only admins can read it;
-- nobody can change or delete rows through the app.
create table if not exists public.plan_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  admin_id   uuid,
  target     uuid,
  email      text,
  action     text not null,
  plan       text,
  until_ts   timestamptz
);
alter table public.plan_log enable row level security;
alter table public.plan_log force row level security;
revoke all on public.plan_log from anon, authenticated;
grant select on public.plan_log to authenticated;
drop policy if exists "plan_log admin read" on public.plan_log;
create policy "plan_log admin read" on public.plan_log for select to authenticated using (private.is_admin());

-- Admin tools: grant or remove a plan by email (for example after someone pays by GCash and you confirm it).
--   select public.admin_grant_plan('person@example.com', 'annual');   -- 'monthly' | 'annual' | 'lifetime'
--   select public.admin_revoke_plan('person@example.com');
-- Granting monthly/annual EXTENDS from the later of now and their current end date.
-- (Run these from the app signed in as an admin, or the SQL Editor does not count as an admin: see the note below.)
create or replace function public.admin_grant_plan(p_email text, p_plan text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
  base timestamptz;
  until_ts timestamptz;
begin
  if not private.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_plan not in ('monthly', 'annual', 'lifetime') then raise exception 'Unknown plan'; end if;
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then raise exception 'No account with that email'; end if;
  select greatest(now(), coalesce(current_period_end, now())) into base from public.subscriptions where user_id = uid and plan <> 'lifetime';
  base := coalesce(base, now());
  until_ts := case p_plan when 'monthly' then base + interval '1 month' when 'annual' then base + interval '1 year' else null end;
  insert into public.subscriptions (user_id, plan, current_period_end, provider, updated_at)
  values (uid, p_plan, until_ts, 'manual', now())
  on conflict (user_id) do update set plan = excluded.plan, current_period_end = excluded.current_period_end, provider = 'manual', updated_at = now();
  insert into public.plan_log (admin_id, target, email, action, plan, until_ts) values (auth.uid(), uid, p_email, 'grant', p_plan, until_ts);
  return until_ts;
end $$;

create or replace function public.admin_revoke_plan(p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  insert into public.plan_log (admin_id, target, email, action) values (auth.uid(), (select id from auth.users where lower(email) = lower(p_email)), p_email, 'revoke');
  delete from public.subscriptions where user_id = (select id from auth.users where lower(email) = lower(p_email));
end $$;

revoke all on function public.admin_grant_plan(text, text) from public, anon;
revoke all on function public.admin_revoke_plan(text) from public, anon;
grant execute on function public.admin_grant_plan(text, text) to authenticated;
grant execute on function public.admin_revoke_plan(text) to authenticated;

-- NOTE: private.is_admin() looks at the signed-in app user (auth.uid()), which is empty in the SQL Editor. So in the
-- SQL Editor, grant a plan directly instead:
--   insert into public.subscriptions (user_id, plan, current_period_end, provider)
--   values ((select id from auth.users where email = 'person@example.com'), 'lifetime', null, 'manual')
--   on conflict (user_id) do update set plan = excluded.plan, current_period_end = excluded.current_period_end;

-- One-time kindness: anyone who already has a cloud backup gets 30 days of access, so nobody's sync stops overnight.
insert into public.subscriptions (user_id, plan, current_period_end, provider)
select user_id, 'monthly', now() + interval '30 days', 'grace' from public.snapshots
on conflict (user_id) do nothing;
