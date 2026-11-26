-- Run once in Supabase (after feedback.sql and testimonials.sql): SQL Editor > New query > paste > Run.
-- Gives the /admin page its rules: ONLY accounts listed in `admins` can read or manage feedback.
-- Everyone else still can only add feedback.

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins for select to authenticated using (user_id = (select auth.uid()));
grant select on public.admins to authenticated;
-- No insert/update/delete: you add admins here in the SQL Editor only (see the last step below).

-- The check lives in a `private` schema, which the Supabase API doesn't expose, so signed-in users can't call it
-- as /rest/v1/rpc/is_admin. The row rules below still can use it (they need `usage` on the schema + `execute`).
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;
-- (Older installs had public.is_admin(). feedback-attachments.sql drops it once nothing points at it any more.)

-- Admins can read feedback and change only `status` and `approved`. Not the message, not who sent it.
-- Column-level: everything except user_id, so nobody (admin page included) reads who wrote what from the table.
-- (The admin list below is a function that returns the sender's email only when they agreed to be contacted.)
grant select (id, kind, message, rating, contact_ok, public_ok, display_name, approved, status, screen, app_version, created_at)
  on public.feedback to authenticated;
grant update (status, approved) on public.feedback to authenticated;

drop policy if exists "feedback admin read" on public.feedback;
create policy "feedback admin read" on public.feedback for select to authenticated using (private.is_admin());
drop policy if exists "feedback admin update" on public.feedback;
create policy "feedback admin update" on public.feedback for update to authenticated using (private.is_admin()) with check (private.is_admin());

-- The list the admin page loads. The sender's email is included ONLY when they ticked "OK to contact me".
-- (Dropped first so re-running this on an install that already has the attachments version doesn't fail;
-- feedback-attachments.sql, run next, puts the version with the attachment column back.)
drop function if exists public.admin_feedback();
create or replace function public.admin_feedback() returns table (
  id uuid, kind text, message text, rating smallint, contact_ok boolean, public_ok boolean,
  display_name text, approved boolean, status text, screen text, app_version text,
  created_at timestamptz, email text
)
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select f.id, f.kind, f.message, f.rating, f.contact_ok, f.public_ok, f.display_name, f.approved, f.status,
           f.screen, f.app_version, f.created_at, (case when f.contact_ok then u.email::text end)
    from public.feedback f
    left join auth.users u on u.id = f.user_id
    order by f.created_at desc
    limit 500;
end $$;
revoke all on function public.admin_feedback() from public, anon;
grant execute on function public.admin_feedback() to authenticated;

-- LAST STEP: make yourself an admin. Replace the email with the one you sign in to Kwenta with, then run just this line.
-- insert into public.admins (user_id) select id from auth.users where email = 'YOUR-LOGIN-EMAIL';
