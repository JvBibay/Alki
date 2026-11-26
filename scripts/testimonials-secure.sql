-- Run once in Supabase if you ALREADY ran testimonials.sql / admin.sql before: SQL Editor > New query > paste > Run.
-- Fixes the "View public.public_testimonials is defined with the SECURITY DEFINER property" warning.
-- The view now runs with the reader's rights, and the public can only see approved testimonials:
-- only these columns, only these rows. user_id is never readable through the API.

-- 1. Public (and signed-in) readers may see rows that are approved AND marked OK to show publicly.
drop policy if exists "feedback public read approved" on public.feedback;
create policy "feedback public read approved" on public.feedback
  for select to anon, authenticated using (approved = true and public_ok = true);

-- 2. Column-level access: anon gets only what a testimonial shows.
grant usage on schema public to anon;
revoke select on public.feedback from anon;
grant select (id, message, display_name, created_at, approved, public_ok) on public.feedback to anon;

-- 3. Signed-in users (admins use the same role): everything except user_id. Admins still see all rows
--    through the existing admin policy; everyone else only sees approved ones.
revoke select on public.feedback from authenticated;
grant select (id, kind, message, rating, contact_ok, public_ok, display_name, approved, status, screen, app_version, created_at)
  on public.feedback to authenticated;
-- If you have run feedback-attachments.sql, also run this line:
-- grant select (attachment) on public.feedback to authenticated;

-- 4. Rebuild the view so it uses the reader's rights.
drop view if exists public.public_testimonials;
create view public.public_testimonials with (security_invoker = true) as
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
