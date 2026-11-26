-- Run once in Supabase if you ALREADY ran plans.sql: SQL Editor > New query > paste > Run. Safe to run more than once.
-- (Run this instead of re-running plans.sql, which also contains a one-time 30-day grace insert.)
--
-- 1. private.has_access(uid) only answers for the signed-in user. Before, any signed-in person could pass someone else's
--    user id and learn whether that account was an admin, on a paid plan or on the trial. Every caller already passes
--    auth.uid() (the snapshot policies and my_access), so nothing changes for them. In the SQL Editor (no signed-in
--    user) it now returns false for everyone.
-- 2. admin_grant_plan refuses to replace a lifetime plan with a monthly or annual one (an easy slip that would turn
--    "forever" into one month). Revoke the lifetime plan first if you really mean it.
-- 3. admin_revoke_plan says so when the email has no account, instead of logging a revoke for nobody.

create or replace function private.has_access(uid uuid) returns boolean
language sql security definer stable set search_path = public, auth as $$
  select coalesce(uid = (select auth.uid()), false)
     and (
          exists (select 1 from public.admins where user_id = uid)
       or exists (select 1 from public.subscriptions where user_id = uid and (plan = 'lifetime' or current_period_end > now()))
       or exists (select 1 from auth.users where id = uid and created_at > now() - interval '7 days')
     )
$$;
revoke all on function private.has_access(uuid) from public, anon;
grant execute on function private.has_access(uuid) to authenticated;

create or replace function public.admin_grant_plan(p_email text, p_plan text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
  cur text;
  base timestamptz;
  until_ts timestamptz;
begin
  if not private.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_plan not in ('monthly', 'annual', 'lifetime') then raise exception 'Unknown plan'; end if;
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then raise exception 'No account with that email'; end if;
  select plan into cur from public.subscriptions where user_id = uid;
  if cur = 'lifetime' and p_plan <> 'lifetime' then
    raise exception 'This account already has a lifetime plan. Revoke it first if you really want to replace it.';
  end if;
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
declare
  uid uuid;
begin
  if not private.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then raise exception 'No account with that email'; end if;
  insert into public.plan_log (admin_id, target, email, action) values (auth.uid(), uid, p_email, 'revoke');
  delete from public.subscriptions where user_id = uid;
end $$;

revoke all on function public.admin_grant_plan(text, text) from public, anon;
revoke all on function public.admin_revoke_plan(text) from public, anon;
grant execute on function public.admin_grant_plan(text, text) to authenticated;
grant execute on function public.admin_revoke_plan(text) to authenticated;
