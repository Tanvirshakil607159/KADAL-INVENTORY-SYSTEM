-- =====================================================================================
-- KADAL security lockdown: password hashes and user accounts
-- Run in the Supabase SQL editor ONLY AFTER every desktop PC runs the version that
-- contains this file and the web build has been redeployed (older versions read
-- password_hash directly and will no longer be able to log in once this is applied).
--
-- What it does
--   * Login, password change and user management move into server-side functions.
--     Passwords are checked inside Postgres (pgcrypto; compatible with existing bcrypt hashes).
--   * The public (anon) key can no longer read password hashes or create/alter users and roles.
-- What it does NOT do
--   * Business tables (items, challans, ...) are still readable/writable with the public key.
--     Closing that needs Supabase Auth (signed-in sessions + row level security) - see notes.
-- Safe to run more than once.
-- =====================================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Server-side sessions issued by kadal_login
create table if not exists public.kadal_sessions (
  token uuid primary key default extensions.gen_random_uuid(),
  user_id integer not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
revoke all on public.kadal_sessions from public, anon, authenticated;

-- bcryptjs writes $2a$ hashes; normalise $2b$/$2y$ (same algorithm) for pgcrypto
create or replace function public.kadal_check_password(p_password text, p_hash text)
returns boolean language sql immutable set search_path = public, extensions as $$
  select p_hash is not null
     and extensions.crypt(p_password, regexp_replace(p_hash, '^\$2[by]\$', '$2a$'))
         = regexp_replace(p_hash, '^\$2[by]\$', '$2a$');
$$;

create or replace function public.kadal_hash_password(p_password text)
returns text language sql volatile set search_path = public, extensions as $$
  select extensions.crypt(p_password, extensions.gen_salt('bf', 10));
$$;

-- Resolve a session token to its user (raises if missing/expired/inactive)
create or replace function public.kadal_session_user(p_token uuid)
returns table (user_id integer, role_name text, permissions text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
    select u.id, r.name::text, coalesce(u.custom_permissions::text, r.permissions::text)
    from public.kadal_sessions s
    join public.users u on u.id = s.user_id
    left join public.roles r on r.id = u.role_id
    where s.token = p_token and s.expires_at > now() and u.is_active;
  if not found then
    raise exception 'Session expired. Please log in again.' using errcode = '28000';
  end if;
end $$;

create or replace function public.kadal_login(p_username text, p_password text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  u record;
  tok uuid;
begin
  select us.id, us.username, us.full_name, us.role_id, us.is_active, us.password_hash,
         us.custom_permissions, r.name as role_name, r.permissions as role_permissions
    into u
    from public.users us left join public.roles r on r.id = us.role_id
   where lower(us.username) = lower(p_username)
   limit 1;
  if u.id is null or not public.kadal_check_password(p_password, u.password_hash) then
    raise exception 'Invalid username or password' using errcode = '28P01';
  end if;
  if not u.is_active then
    raise exception 'Account is deactivated' using errcode = '28000';
  end if;
  update public.users set last_login = now() where id = u.id;
  delete from public.kadal_sessions where expires_at < now();
  insert into public.kadal_sessions (user_id, expires_at) values (u.id, now() + interval '12 hours')
    returning token into tok;
  return json_build_object(
    'id', u.id, 'username', u.username, 'full_name', u.full_name, 'role_id', u.role_id,
    'role_name', u.role_name, 'permissions', coalesce(u.custom_permissions::text, u.role_permissions::text),
    'token', tok);
end $$;

create or replace function public.kadal_logout(p_token uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.kadal_sessions where token = p_token;
$$;

create or replace function public.kadal_change_password(p_token uuid, p_old text, p_new text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  me record;
  cur text;
begin
  select * into me from public.kadal_session_user(p_token);
  select password_hash into cur from public.users where id = me.user_id;
  if not public.kadal_check_password(p_old, cur) then
    raise exception 'Current password is incorrect';
  end if;
  if length(coalesce(p_new, '')) < 4 then
    raise exception 'Password must be at least 4 characters';
  end if;
  update public.users set password_hash = public.kadal_hash_password(p_new), updated_at = now() where id = me.user_id;
  return true;
end $$;

-- Only Admin / Super Admin, or users given user-management rights, may manage accounts
create or replace function public.kadal_require_user_admin(p_token uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  me record;
  perms jsonb;
begin
  select * into me from public.kadal_session_user(p_token);
  if me.role_name in ('Admin', 'Super Admin') then return me.user_id; end if;
  begin perms := me.permissions::jsonb; exception when others then perms := '{}'::jsonb; end;
  if perms->>'settings_users' = 'rw' or perms->>'users' = 'rw'
     or perms->>'settings_users' = 'true' or perms->>'users' = 'true' then
    return me.user_id;
  end if;
  raise exception 'You do not have permission to manage users' using errcode = '42501';
end $$;

create or replace function public.kadal_save_user(
  p_token uuid, p_id integer, p_username text, p_password text, p_full_name text,
  p_role_id integer, p_custom_permissions text, p_is_active boolean)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  new_id integer;
  target_name text;
begin
  perform public.kadal_require_user_admin(p_token);
  if p_id is null then
    if coalesce(p_username, '') = '' or coalesce(p_password, '') = '' then
      raise exception 'Username and password are required';
    end if;
    if exists (select 1 from public.users where lower(username) = lower(p_username)) then
      raise exception 'Username already taken';
    end if;
    -- %L lets Postgres cast the permissions literal to the column type (text or jsonb)
    execute format(
      'insert into public.users (username, password_hash, full_name, role_id, custom_permissions, is_active)
       values (%L, %L, %L, %s, %L, %L) returning id',
      p_username, public.kadal_hash_password(p_password), p_full_name,
      coalesce(p_role_id::text, 'null'), nullif(p_custom_permissions, ''), coalesce(p_is_active, true))
    into new_id;
    return new_id;
  end if;

  select username into target_name from public.users where id = p_id;
  if target_name is null then raise exception 'User not found'; end if;
  if lower(target_name) in ('admin', 'superadmin') and p_is_active = false then
    raise exception 'The % user cannot be deactivated.', target_name;
  end if;
  update public.users set
    full_name = coalesce(p_full_name, full_name),
    role_id = coalesce(p_role_id, role_id),
    is_active = coalesce(p_is_active, is_active),
    password_hash = case when coalesce(p_password, '') <> '' then public.kadal_hash_password(p_password) else password_hash end,
    updated_at = now()
  where id = p_id;
  if p_custom_permissions is not null then
    execute format('update public.users set custom_permissions = %L where id = %s',
                   nullif(p_custom_permissions, ''), p_id);
  end if;
  return p_id;
end $$;

create or replace function public.kadal_delete_user(p_token uuid, p_id integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  me integer;
begin
  me := public.kadal_require_user_admin(p_token);
  if me = p_id then raise exception 'You cannot delete your own account'; end if;
  if exists (select 1 from public.users where id = p_id and lower(username) in ('admin', 'superadmin')) then
    raise exception 'This user cannot be deleted to prevent system lockout.';
  end if;
  delete from public.users where id = p_id;
  return true;
end $$;

-- Self-registration: creates an INACTIVE account with the Operator role (an admin activates it)
create or replace function public.kadal_register(p_username text, p_password text, p_full_name text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if coalesce(p_username, '') = '' or coalesce(p_password, '') = '' or coalesce(p_full_name, '') = '' then
    raise exception 'All fields are required';
  end if;
  if length(p_password) < 4 then raise exception 'Password must be at least 4 characters'; end if;
  if exists (select 1 from public.users where lower(username) = lower(p_username)) then
    raise exception 'Username already taken';
  end if;
  insert into public.users (username, password_hash, full_name, role_id, is_active)
  values (p_username, public.kadal_hash_password(p_password), p_full_name,
          (select id from public.roles where name = 'Operator' order by id limit 1), false);
  return true;
end $$;

-- Lock the tables: no hashes, no direct account changes through the public key
revoke all on public.users from anon, authenticated;
grant select (id, username, full_name, role_id, is_active, last_login, created_at, updated_at, custom_permissions)
  on public.users to anon, authenticated;
revoke insert, update, delete, truncate on public.roles from anon, authenticated;
grant select on public.roles to anon, authenticated;

revoke all on function public.kadal_check_password(text, text) from public, anon, authenticated;
revoke all on function public.kadal_hash_password(text) from public, anon, authenticated;
revoke all on function public.kadal_session_user(uuid) from public, anon, authenticated;
revoke all on function public.kadal_require_user_admin(uuid) from public, anon, authenticated;
grant execute on function public.kadal_login(text, text) to anon, authenticated;
grant execute on function public.kadal_logout(uuid) to anon, authenticated;
grant execute on function public.kadal_change_password(uuid, text, text) to anon, authenticated;
grant execute on function public.kadal_save_user(uuid, integer, text, text, text, integer, text, boolean) to anon, authenticated;
grant execute on function public.kadal_delete_user(uuid, integer) to anon, authenticated;
grant execute on function public.kadal_register(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
