-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- Users can only ADD feedback (as themselves). Nobody can read, change or delete it through the app;
-- you read it in the dashboard Table Editor, which bypasses these rules.

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('idea', 'problem', 'praise')),
  message     text not null check (char_length(message) between 3 and 1000),
  rating      smallint check (rating between 1 and 3),
  contact_ok  boolean not null default false,
  screen      text check (char_length(screen) <= 40),
  app_version text check (char_length(app_version) <= 40),
  created_at  timestamptz not null default now(),
  status      text not null default 'new' check (status in ('new', 'seen', 'done'))
);

alter table public.feedback enable row level security;

-- New tables aren't always open to the API roles automatically. Insert only: no read, update or delete.
grant usage on schema public to authenticated;
grant insert on public.feedback to authenticated;

drop policy if exists "feedback insert own" on public.feedback;
create policy "feedback insert own" on public.feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'new');

-- No select / update / delete policy on purpose.

-- Cap abuse: at most 20 pieces of feedback per account per day.
-- security definer: users can't read the table, so the count has to run with the owner's rights.
create or replace function public.feedback_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.feedback where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Too much feedback today, please try again tomorrow.';
  end if;
  return new;
end $$;

revoke all on function public.feedback_limit() from public, anon, authenticated;

drop trigger if exists feedback_limit on public.feedback;
create trigger feedback_limit before insert on public.feedback
  for each row execute function public.feedback_limit();
