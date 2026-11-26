-- Run once in Supabase (after feedback.sql): SQL Editor > New query > paste > Run.
-- Lets you publish selected feedback as testimonials. Nothing is public until YOU tick `approved`
-- in the Table Editor, and only for people who ticked "show publicly". The name is masked (J***).

alter table public.feedback add column if not exists public_ok    boolean not null default false;
alter table public.feedback add column if not exists display_name text check (char_length(display_name) <= 30);
alter table public.feedback add column if not exists approved     boolean not null default false;

-- People can add feedback but never approve their own.
drop policy if exists "feedback insert own" on public.feedback;
create policy "feedback insert own" on public.feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'new' and approved = false);

-- The only thing the public can read: message, masked name, date. No email, no account id.
-- The view runs with the READER's rights (security_invoker), so row-level security still applies:
-- the policy and column grants below are what let the public see approved testimonials, and nothing else.
drop policy if exists "feedback public read approved" on public.feedback;
create policy "feedback public read approved" on public.feedback
  for select to anon, authenticated using (approved = true and public_ok = true);
grant usage on schema public to anon;
grant select (id, message, display_name, created_at, approved, public_ok) on public.feedback to anon;

create or replace view public.public_testimonials with (security_invoker = true) as
  select
    id,
    message,
    coalesce(nullif(left(btrim(display_name), 1), '') || '***', 'Kwenta user') as author,
    created_at
  from public.feedback
  where approved = true and public_ok = true
  order by created_at desc
  limit 30;

revoke all on public.public_testimonials from public;
grant select on public.public_testimonials to anon, authenticated;
