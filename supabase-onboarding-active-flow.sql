-- Onboarding + ACTIVE onayı + global kullanıcı adı + login/register akışı
-- Supabase SQL Editor'de çalıştırın (mevcut projeler için).
-- Ön koşul: supabase-multi-tenant-businesses.sql ve pgcrypto kurulu olmalı.

create extension if not exists pgcrypto with schema extensions;

-- ── businesses genişletmesi ──
alter table public.businesses
  add column if not exists manager_display_name text;

update public.businesses
set manager_display_name = coalesce(trim(manager_display_name), '')
where manager_display_name is null;

alter table public.businesses
  alter column manager_display_name set default '';

alter table public.businesses
  alter column manager_display_name set not null;

alter table public.businesses
  add column if not exists active boolean;

alter table public.businesses
  add column if not exists onboarding_complete boolean;

-- Eski kayıtlar: slug onaylı işletme mantığı (bekleyen iskelet pending-%)
update public.businesses
set active = true,
    onboarding_complete = true
where slug not like 'pending-%';

update public.businesses
set active = coalesce(active, false),
    onboarding_complete = coalesce(onboarding_complete, false)
where slug like 'pending-%';

alter table public.businesses
  alter column active set default false;

alter table public.businesses
  alter column onboarding_complete set default false;

alter table public.businesses
  alter column active set not null;

alter table public.businesses
  alter column onboarding_complete set not null;

-- Varsayılan işletme her zaman açık
update public.businesses
set active = true,
    onboarding_complete = true,
    manager_display_name = coalesce(nullif(trim(manager_display_name), ''), '')
where id = 'a0000000-0000-4000-8000-000000000001';

-- Global kullanıcı adı (login slug olmadan)
create unique index if not exists business_users_username_lower_uq
  on public.business_users (lower(trim(username)));

-- 10 masa tohumu (idempotent)
create or replace function public.seed_default_tables_for_business(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cafe_tables (business_id, id, name)
  select p_business_id, n, 'Masa ' || n
  from generate_series(1, 10) as n
  on conflict (business_id, id) do nothing;
end;
$$;

-- Müşteri menüsü: yalnızca onaylı işletmeler
create or replace function public.resolve_business_id_by_slug(p_slug text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.businesses
  where slug = lower(trim(p_slug))
    and active = true
    and onboarding_complete = true
  limit 1;
$$;

grant execute on function public.resolve_business_id_by_slug(text) to anon;
grant execute on function public.resolve_business_id_by_slug(text) to authenticated;

-- slug ile eski giriş (İsterseniz istemcilerden kaldırılır; geriye dönük için durabilir)
create or replace function public.login_business(p_slug text, p_username text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_bid uuid;
  v_hash text;
begin
  select bu.business_id, bu.password_hash into v_bid, v_hash
  from public.business_users bu
  inner join public.businesses b on b.id = bu.business_id
  where b.slug = lower(trim(p_slug))
    and lower(trim(bu.username)) = lower(trim(p_username));
  if v_bid is null then
    return null;
  end if;
  if v_hash = crypt(p_password, v_hash) then
    return v_bid;
  end if;
  return null;
end;
$$;

grant execute on function public.login_business(text, text, text) to anon;
grant execute on function public.login_business(text, text, text) to authenticated;

-- Yeni: slug olmadan giriş
create or replace function public.login_user(p_username text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_bid uuid;
  v_hash text;
  v_active boolean;
  v_oc boolean;
begin
  select bu.business_id, bu.password_hash, b.active, b.onboarding_complete
    into v_bid, v_hash, v_active, v_oc
  from public.business_users bu
  inner join public.businesses b on b.id = bu.business_id
  where lower(trim(bu.username)) = lower(trim(p_username))
  limit 1;

  if v_bid is null then
    return null;
  end if;

  if v_hash <> crypt(p_password, v_hash) then
    return null;
  end if;

  return json_build_object(
    'business_id', v_bid::text,
    'active', coalesce(v_active, false),
    'onboarding_complete', coalesce(v_oc, false)
  );
end;
$$;

grant execute on function public.login_user(text, text) to anon;
grant execute on function public.login_user(text, text) to authenticated;

-- Yeni kayıt: işletme iskeleti + kullanıcı + 10 masa (onaysız, onboarding sonrası tamamlanır)
create or replace function public.register_user(p_username text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_user text := lower(trim(p_username));
  v_slug text;
begin
  if length(v_user) < 2 or length(p_password) < 8 then
    raise exception 'Geçersiz kullanıcı adı veya şifre (şifre en az 8 karakter)';
  end if;

  v_slug := 'pending-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.businesses (name, slug, active, onboarding_complete, manager_display_name)
  values ('', v_slug, false, false, '')
  returning id into v_id;

  insert into public.business_users (business_id, username, password_hash)
  values (v_id, v_user, crypt(p_password, gen_salt('bf')));

  perform public.seed_default_tables_for_business(v_id);

  return json_build_object(
    'business_id', v_id::text,
    'active', false,
    'onboarding_complete', false
  );
exception
  when unique_violation then
    raise exception 'Bu kullanıcı adı zaten kullanılıyor';
end;
$$;

grant execute on function public.register_user(text, text) to anon;
grant execute on function public.register_user(text, text) to authenticated;

-- Eski register_business (dört parametre) — kullanılmıyorsa istemciyi güncelleyin
create or replace function public.register_business(
  p_name text,
  p_slug text,
  p_username text,
  p_password text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  raise exception 'Kayıt akışı değişti; register_user kullanın.';
end;
$$;

create or replace function public.complete_business_onboarding(
  p_username text,
  p_password text,
  p_business_name text,
  p_manager_name text,
  p_slug text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_bid uuid;
  v_hash text;
  v_slug text := lower(trim(p_slug));
begin
  if length(trim(p_business_name)) < 1 or length(trim(p_manager_name)) < 1 then
    raise exception 'İşletme adı ve yönetici adı gerekli';
  end if;
  if length(v_slug) < 2 or v_slug like 'pending-%' then
    raise exception 'Geçersiz kısa adres';
  end if;

  select bu.business_id, bu.password_hash into v_bid, v_hash
  from public.business_users bu
  where lower(trim(bu.username)) = lower(trim(p_username))
  limit 1;

  if v_bid is null or v_hash <> crypt(p_password, v_hash) then
    raise exception 'Kimlik doğrulanamadı';
  end if;

  update public.businesses
  set
    name = trim(p_business_name),
    slug = v_slug,
    manager_display_name = trim(p_manager_name),
    onboarding_complete = true,
    active = false
  where id = v_bid;

  return json_build_object(
    'business_id', v_bid::text,
    'active', false,
    'onboarding_complete', true
  );
exception
  when unique_violation then
    raise exception 'Bu kısa adres zaten kullanılıyor';
end;
$$;

grant execute on function public.complete_business_onboarding(text, text, text, text, text) to anon;
grant execute on function public.complete_business_onboarding(text, text, text, text, text) to authenticated;

create or replace function public.complete_business_onboarding_google(
  p_business_name text,
  p_manager_name text,
  p_slug text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_bid uuid;
  uid uuid := auth.uid();
  v_slug text := lower(trim(p_slug));
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;

  if length(trim(p_business_name)) < 1 or length(trim(p_manager_name)) < 1 then
    raise exception 'İşletme adı ve yönetici adı gerekli';
  end if;
  if length(v_slug) < 2 or v_slug like 'pending-%' then
    raise exception 'Geçersiz kısa adres';
  end if;

  select business_id into v_bid
  from public.business_users
  where auth_user_id = uid
  limit 1;

  if v_bid is null then
    raise exception 'İşletme kaydı bulunamadı';
  end if;

  update public.businesses
  set
    name = trim(p_business_name),
    slug = v_slug,
    manager_display_name = trim(p_manager_name),
    onboarding_complete = true,
    active = false
  where id = v_bid;

  return json_build_object(
    'business_id', v_bid::text,
    'active', false,
    'onboarding_complete', true
  );
exception
  when unique_violation then
    raise exception 'Bu kısa adres zaten kullanılıyor';
end;
$$;

grant execute on function public.complete_business_onboarding_google(text, text, text) to authenticated;

create or replace function public.get_panel_state_for_auth_user()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'business_id', bu.business_id::text,
    'active', b.active,
    'onboarding_complete', b.onboarding_complete,
    'username', bu.username
  )
  from public.business_users bu
  join public.businesses b on b.id = bu.business_id
  where bu.auth_user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.get_panel_state_for_auth_user() to authenticated;

-- Bekleme ekranı: işletme UUID ile güncel bayraklar (küçük iç araç; UUID tahmini zordur)
create or replace function public.revalidate_business_flags(p_business_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'active', b.active,
    'onboarding_complete', b.onboarding_complete
  )
  from public.businesses b
  where b.id = p_business_id;
$$;

grant execute on function public.revalidate_business_flags(uuid) to anon;
grant execute on function public.revalidate_business_flags(uuid) to authenticated;

-- Google: ilk OAuth sonrası iskelet işletme + kullanıcı + masa
create or replace function public.register_google_skeleton_business()
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  uid uuid := auth.uid();
  v_slug text;
  v_username text;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;

  if exists (select 1 from public.business_users where auth_user_id = uid) then
    raise exception 'Bu Google hesabı zaten bir işletmeye bağlı';
  end if;

  v_slug := 'pending-' || replace(gen_random_uuid()::text, '-', '');
  v_username := 'g-' || replace(uid::text, '-', '');

  insert into public.businesses (name, slug, active, onboarding_complete, manager_display_name)
  values ('', v_slug, false, false, '')
  returning id into v_id;

  insert into public.business_users (business_id, username, password_hash, auth_user_id)
  values (v_id, v_username, crypt(gen_random_uuid()::text, gen_salt('bf')), uid);

  perform public.seed_default_tables_for_business(v_id);

  return json_build_object(
    'business_id', v_id::text,
    'active', false,
    'onboarding_complete', false,
    'username', v_username
  );
end;
$$;

grant execute on function public.register_google_skeleton_business() to authenticated;

-- Eski register_business_with_google yerine bu kullanılmıyor; uyumluluk için stub
create or replace function public.register_business_with_google(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Akış değişti; önce register_google_skeleton_business ardından onboarding.';
end;
$$;
