-- Push reminders (iPhone, desktop and Android). Run once in Supabase: SQL Editor > New query > paste > Run.
-- Full setup steps are in the README under "Push reminders".
--
-- What the server learns: which devices want reminders and WHEN to wake them. It never learns what is due, the
-- names, or any amounts. The wake-up push carries no content; the phone fills in the text from its own saved list.

create table if not exists public.push_devices (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique check (char_length(endpoint) <= 2000),
  p256dh     text not null check (char_length(p256dh) <= 200),
  auth_key   text not null check (char_length(auth_key) <= 100),
  created_at timestamptz not null default now()
);

create table if not exists public.push_wakes (
  id        bigint generated always as identity primary key,
  device_id uuid not null references public.push_devices(id) on delete cascade,
  fire_at   timestamptz not null,
  sent      boolean not null default false,
  unique (device_id, fire_at)
);

create index if not exists push_wakes_due on public.push_wakes (fire_at) where sent = false;

-- Safety: a push address must belong to a real browser push service (Google, Apple, Mozilla, Microsoft), over https
-- with no port or login in it. Without this, an account could make the server send requests to any address it likes.
alter table public.push_devices drop constraint if exists push_devices_endpoint_host;
alter table public.push_devices add constraint push_devices_endpoint_host check (
  endpoint ~* '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)/[^[:space:]]*$'
);

alter table public.push_devices enable row level security;
alter table public.push_wakes enable row level security;

-- Devices: you can see and remove your own. Adding goes through register_push_device() below.
-- Wakes: no direct access at all. The app uses set_push_wakes(); the sender function bypasses these rules.
revoke all on public.push_devices from anon;
revoke all on public.push_wakes from anon;
grant usage on schema public to authenticated;
grant select, delete on public.push_devices to authenticated;

-- The sender function runs as service_role. It skips the row rules but still needs table permissions.
grant select, update, delete on public.push_wakes to service_role;
grant select, delete on public.push_devices to service_role;

-- Wakes: say out loud that nobody signed in or anonymous can touch them directly (the sender and the functions
-- below don't go through these rules). This also settles Supabase's "RLS enabled, no policy" notice.
drop policy if exists "push wakes no direct access" on public.push_wakes;
create policy "push wakes no direct access" on public.push_wakes
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "push devices select own" on public.push_devices;
create policy "push devices select own" on public.push_devices
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "push devices delete own" on public.push_devices;
create policy "push devices delete own" on public.push_devices
  for delete to authenticated using (user_id = (select auth.uid()));

-- Save (or refresh) this phone's push address. If the same address was registered under another account on this
-- phone, that old row is replaced. Returns the device id.
create or replace function public.register_push_device(p_endpoint text, p_p256dh text, p_auth text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  did uuid;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if p_endpoint !~* '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)/[^[:space:]]*$' then
    raise exception 'This browser''s push service isn''t supported.';
  end if;
  if (select count(*) from public.push_devices where user_id = uid and endpoint <> p_endpoint) >= 10 then
    raise exception 'Too many devices. Turn push reminders off on one you no longer use.';
  end if;
  delete from public.push_devices where endpoint = p_endpoint and user_id <> uid;
  insert into public.push_devices (user_id, endpoint, p256dh, auth_key)
  values (uid, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth_key = excluded.auth_key
  returning id into did;
  return did;
end $$;

-- Replace this device's upcoming wake-up times (at most 30, none in the past or more than 14 days out).
create or replace function public.set_push_wakes(p_device uuid, p_times timestamptz[])
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if not exists (select 1 from public.push_devices where id = p_device and user_id = uid) then
    raise exception 'Unknown device.';
  end if;
  delete from public.push_wakes where device_id = p_device and sent = false;
  insert into public.push_wakes (device_id, fire_at)
  select distinct p_device, t
  from unnest(p_times[1:30]) as t
  where t > now() - interval '1 minute' and t < now() + interval '14 days'
  on conflict do nothing;
end $$;

revoke all on function public.register_push_device(text, text, text) from public;
revoke all on function public.set_push_wakes(uuid, timestamptz[]) from public;
revoke all on function public.register_push_device(text, text, text) from anon;
revoke all on function public.set_push_wakes(uuid, timestamptz[]) from anon;
grant execute on function public.register_push_device(text, text, text) to authenticated;
grant execute on function public.set_push_wakes(uuid, timestamptz[]) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Schedule the sender (every 15 minutes). Do this AFTER deploying the send-reminders function and setting its
-- secrets (see README). Replace the two placeholders, then run this part.
--
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net with schema extensions;
--   select cron.schedule(
--     'kwenta-send-reminders',
--     '*/15 * * * *',
--     $cron$
--       select net.http_post(
--         url     := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-reminders',
--         headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR-CRON-SECRET'),
--         body    := '{}'::jsonb
--       );
--     $cron$
--   );
--
-- To stop it later:  select cron.unschedule('kwenta-send-reminders');
