-- One person, one account: blocks sign-ups that are just another spelling of an email that is already registered.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run more than once.
--
-- Supabase already refuses the exact same email. This also refuses the tricks used to get extra 7-day trials:
--   Name+1@gmail.com   (a "+tag" on any address)
--   n.a.me@gmail.com   (dots in Gmail addresses are ignored by Gmail)
--   NAME@GMAIL.COM     (capital letters)
--   name@googlemail.com (Google's other domain for Gmail)

create schema if not exists private;

create or replace function private.norm_email(e text) returns text
language sql immutable as $$
  with p as (select lower(btrim(e)) as v),
  s as (select split_part(v, '@', 1) as lp, split_part(v, '@', 2) as dom from p)
  select case
    when dom in ('gmail.com', 'googlemail.com') then replace(split_part(lp, '+', 1), '.', '') || '@gmail.com'
    else split_part(lp, '+', 1) || '@' || dom
  end
  from s
$$;

create or replace function private.block_duplicate_email() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if new.email is not null and exists (
    select 1 from auth.users u where u.id <> new.id and private.norm_email(u.email) = private.norm_email(new.email)
  ) then
    raise exception 'Email already registered' using errcode = '23505';
  end if;
  return new;
end $$;

revoke all on function private.block_duplicate_email() from public, anon, authenticated;

drop trigger if exists block_duplicate_email on auth.users;
create trigger block_duplicate_email before insert on auth.users
  for each row execute function private.block_duplicate_email();

-- CHECK (optional): accounts that already look like the same person, from before this rule existed.
--   select private.norm_email(email) as same_as, count(*), array_agg(email)
--   from auth.users group by 1 having count(*) > 1;
