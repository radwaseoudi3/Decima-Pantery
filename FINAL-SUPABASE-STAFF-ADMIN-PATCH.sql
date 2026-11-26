-- DECIMA PANTRY - one shared staff login + protected Admin mode
-- Run once in Supabase SQL Editor AFTER the main Pantry setup.

create extension if not exists pgcrypto;

-- Use the single real Pantry staff account for receiving/managing orders.
delete from public.pantry_staff;
insert into public.pantry_staff(email, role)
values ('mahmoud.mohey@decimaintl.com', 'barista')
on conflict (email) do update set role = excluded.role;

-- Admin password is stored only as a bcrypt hash in Supabase.
create table if not exists public.pantry_admin_config (
  id boolean primary key default true check (id = true),
  password_hash text,
  updated_at timestamptz not null default now()
);
insert into public.pantry_admin_config(id, password_hash)
values (true, null)
on conflict (id) do nothing;

-- A successful Admin unlock creates a short-lived server-side token.
create table if not exists public.pantry_admin_sessions (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 minutes')
);

alter table public.pantry_admin_config enable row level security;
alter table public.pantry_admin_sessions enable row level security;
revoke all on public.pantry_admin_config from anon, authenticated;
revoke all on public.pantry_admin_sessions from anon, authenticated;

create or replace function public.pantry_admin_password_configured()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.pantry_is_staff() then
    raise exception 'staff_required';
  end if;
  return coalesce((select password_hash is not null from public.pantry_admin_config where id = true), false);
end;
$$;

create or replace function public.pantry_admin_set_password(p_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.pantry_is_staff() then
    raise exception 'staff_required';
  end if;
  if length(coalesce(p_password,'')) < 6 then
    raise exception 'admin_password_too_short';
  end if;
  if exists (select 1 from public.pantry_admin_config where id = true and password_hash is not null) then
    raise exception 'admin_password_already_set';
  end if;

  update public.pantry_admin_config
  set password_hash = crypt(p_password, gen_salt('bf', 10)), updated_at = now()
  where id = true;
  return true;
end;
$$;

create or replace function public.pantry_admin_unlock(p_password text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_token uuid;
begin
  if not public.pantry_is_staff() then
    raise exception 'staff_required';
  end if;

  select password_hash into v_hash from public.pantry_admin_config where id = true;
  if v_hash is null then
    raise exception 'admin_password_not_set';
  end if;
  if crypt(coalesce(p_password,''), v_hash) <> v_hash then
    raise exception 'invalid_admin_password';
  end if;

  delete from public.pantry_admin_sessions where expires_at <= now() or user_id = auth.uid();
  insert into public.pantry_admin_sessions(user_id, expires_at)
  values (auth.uid(), now() + interval '60 minutes')
  returning token into v_token;
  return v_token;
end;
$$;

create or replace function public.pantry_admin_change_password(p_current_password text, p_new_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  if not public.pantry_is_staff() then
    raise exception 'staff_required';
  end if;
  if length(coalesce(p_new_password,'')) < 6 then
    raise exception 'admin_password_too_short';
  end if;
  select password_hash into v_hash from public.pantry_admin_config where id = true;
  if v_hash is null or crypt(coalesce(p_current_password,''), v_hash) <> v_hash then
    raise exception 'invalid_admin_password';
  end if;

  update public.pantry_admin_config
  set password_hash = crypt(p_new_password, gen_salt('bf', 10)), updated_at = now()
  where id = true;
  delete from public.pantry_admin_sessions where user_id = auth.uid();
  return true;
end;
$$;

create or replace function public.pantry_admin_session_valid()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_headers jsonb;
  v_token_text text;
  v_token uuid;
begin
  if not public.pantry_is_staff() then return false; end if;
  begin
    v_headers := coalesce(current_setting('request.headers', true), '{}')::jsonb;
    v_token_text := v_headers ->> 'x-admin-token';
    if v_token_text is null or v_token_text = '' then return false; end if;
    v_token := v_token_text::uuid;
  exception when others then
    return false;
  end;

  return exists (
    select 1 from public.pantry_admin_sessions
    where token = v_token and user_id = auth.uid() and expires_at > now()
  );
end;
$$;

create or replace function public.pantry_admin_lock(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return false; end if;
  delete from public.pantry_admin_sessions where token = p_token and user_id = auth.uid();
  return true;
end;
$$;

-- Replace the old email-role Admin write policies with second-password protection.
drop policy if exists pantry_materials_admin on public.pantry_materials;
drop policy if exists pantry_drinks_admin on public.pantry_drinks;
drop policy if exists pantry_locations_admin on public.pantry_locations;

create policy pantry_materials_admin on public.pantry_materials
  for all to authenticated
  using (public.pantry_admin_session_valid())
  with check (public.pantry_admin_session_valid());

create policy pantry_drinks_admin on public.pantry_drinks
  for all to authenticated
  using (public.pantry_admin_session_valid())
  with check (public.pantry_admin_session_valid());

create policy pantry_locations_admin on public.pantry_locations
  for all to authenticated
  using (public.pantry_admin_session_valid())
  with check (public.pantry_admin_session_valid());

grant execute on function public.pantry_admin_password_configured() to authenticated;
grant execute on function public.pantry_admin_set_password(text) to authenticated;
grant execute on function public.pantry_admin_unlock(text) to authenticated;
grant execute on function public.pantry_admin_change_password(text,text) to authenticated;
grant execute on function public.pantry_admin_session_valid() to authenticated;
grant execute on function public.pantry_admin_lock(uuid) to authenticated;

select 'Decima Pantry staff/Admin security patch installed successfully.' as result;
