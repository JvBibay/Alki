-- Run once in Supabase (after feedback.sql and admin.sql): SQL Editor > New query > paste > Run.
-- Lets people attach ONE optional screenshot to feedback. Files are private: the sender can upload
-- into their own folder, and only accounts listed in `admins` can view them.

alter table public.feedback add column if not exists attachment text
  check (attachment is null or char_length(attachment) <= 120);

grant select (attachment) on public.feedback to authenticated;

-- Private bucket, JPEG only, 2 MB max (the app shrinks images before uploading).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-files', 'feedback-files', false, 2097152, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];

-- Signed-in users may add files only inside a folder named after their own user id.
drop policy if exists "feedback files upload own" on storage.objects;
create policy "feedback files upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'feedback-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- Only admins can open them.
drop policy if exists "feedback files admin read" on storage.objects;
create policy "feedback files admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'feedback-files' and private.is_admin());

-- The admin list now also returns the attachment path.
drop function if exists public.admin_feedback();
create or replace function public.admin_feedback() returns table (
  id uuid, kind text, message text, rating smallint, contact_ok boolean, public_ok boolean,
  display_name text, approved boolean, status text, screen text, app_version text,
  created_at timestamptz, email text, attachment text
)
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select f.id, f.kind, f.message, f.rating, f.contact_ok, f.public_ok, f.display_name, f.approved, f.status,
           f.screen, f.app_version, f.created_at, (case when f.contact_ok then u.email::text end), f.attachment
    from public.feedback f
    left join auth.users u on u.id = f.user_id
    order by f.created_at desc
    limit 500;
end $$;
revoke all on function public.admin_feedback() from public, anon;
grant execute on function public.admin_feedback() to authenticated;

-- Cleanup for installs made before is_admin moved to the `private` schema (needs admin.sql re-run first, so
-- no policy or function still points at it). Harmless on a fresh install.
drop function if exists public.is_admin();
