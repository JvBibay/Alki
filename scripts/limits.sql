-- Usage limits, so one account (or a script pretending to be one) can't fill or hammer your Supabase project.
-- Run once in Supabase (after snapshots.sql, feedback.sql, admin.sql and feedback-attachments.sql):
-- SQL Editor > New query > paste > Run. Safe to run more than once.
--
-- The app also checks pictures in the browser, but the browser can be bypassed. These rules run inside
-- Supabase, so they hold no matter who is calling the API.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Cloud backup (public.snapshots): one row per user, capped in size, and no rapid-fire rewrites.
-- ---------------------------------------------------------------------------------------------------------------
-- Without this, anyone signed in could upload a multi-hundred-MB "backup" over and over.
alter table public.snapshots add column if not exists written_at timestamptz not null default now();

create or replace function private.snapshots_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  -- 5 MB of encrypted text is far more than a real budget (the receipt photos are NOT in the backup).
  if octet_length(new.data::text) > 5000000 then
    raise exception 'That backup is too large (limit 5 MB).' using errcode = '54000';
  end if;
  -- The app saves at most every 5 seconds; refuse anything faster than once per 2 seconds.
  if tg_op = 'UPDATE' and old.written_at > now() - interval '2 seconds' then
    raise exception 'Saving too fast, please wait a moment.' using errcode = '54000';
  end if;
  new.written_at := now();
  return new;
end $$;

revoke all on function private.snapshots_guard() from public, anon;

drop trigger if exists snapshots_guard on public.snapshots;
create trigger snapshots_guard before insert or update on public.snapshots
  for each row execute function private.snapshots_guard();

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Feedback screenshots (storage bucket feedback-files): strict file name, count limits, size and type.
-- ---------------------------------------------------------------------------------------------------------------
-- Bucket: private, JPEG only, 2 MB per file (enforced by Supabase Storage itself).
update storage.buckets
set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg']
where id = 'feedback-files';

-- How many files an account may have: at most 10 per day and 50 in total.
-- security definer, because users can't read storage.objects themselves (so a plain count would always be 0).
create or replace function private.can_upload_feedback_file(uid uuid) returns boolean
language sql stable security definer set search_path = public, storage as $$
  select
    (select count(*) from storage.objects
       where bucket_id = 'feedback-files' and (storage.foldername(name))[1] = uid::text) < 50
    and
    (select count(*) from storage.objects
       where bucket_id = 'feedback-files' and (storage.foldername(name))[1] = uid::text
         and created_at > now() - interval '1 day') < 10
$$;

revoke all on function private.can_upload_feedback_file(uuid) from public, anon;
grant execute on function private.can_upload_feedback_file(uuid) to authenticated;

-- Upload rule: your own folder only, a plain "<your id>/<letters and digits>.jpg" name (no sub-folders, no odd
-- characters, no other extensions), and only while you are under the limits above.
drop policy if exists "feedback files upload own" on storage.objects;
create policy "feedback files upload own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'feedback-files'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ ('^' || auth.uid()::text || '/[a-z0-9]{6,40}[.]jpg$')
    and private.can_upload_feedback_file(auth.uid())
  );

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Feedback text: tighter daily cap (was 20 a day).
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.feedback_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.feedback where user_id = new.user_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Too much feedback today, please try again tomorrow.';
  end if;
  return new;
end $$;
revoke all on function public.feedback_limit() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- CHECK (optional): how much each account is using right now.
--   select (storage.foldername(name))[1] as user_id, count(*) as files, pg_size_pretty(sum((metadata->>'size')::bigint)) as size
--   from storage.objects where bucket_id = 'feedback-files' group by 1 order by count(*) desc;
--
--   select user_id, pg_size_pretty(octet_length(data::text)::bigint) as backup_size from public.snapshots order by octet_length(data::text) desc;
-- ---------------------------------------------------------------------------------------------------------------
