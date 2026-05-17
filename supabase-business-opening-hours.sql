-- İşletme açılış / kapanış saati (businesses.opening_time, businesses.closing_time)
-- Ön koşul: supabase-onboarding-active-flow.sql uygulanmış olmalı.
-- Supabase SQL Editor'de bir kez çalıştırın.

alter table public.businesses
  add column if not exists opening_time time;

alter table public.businesses
  add column if not exists closing_time time;

-- Eski RPC imzaları değiştiği için bırakıp yeniden oluşturuyoruz
drop function if exists public.complete_business_onboarding(text, text, text, text, text);
drop function if exists public.complete_business_onboarding_google(text, text, text);
drop function if exists public.update_panel_business_profile(text, text, text, text, text);

create or replace function public.complete_business_onboarding(
  p_username text,
  p_password text,
  p_business_name text,
  p_manager_name text,
  p_slug text,
  p_opening_time time default null,
  p_closing_time time default null
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

  if (p_opening_time is null) <> (p_closing_time is null) then
    raise exception 'Açılış ve kapanış saati birlikte girilmelidir'; 
  end if;

  if p_opening_time is not null and p_opening_time = p_closing_time then
    raise exception 'Açılış ve kapanış saatleri farklı olmalıdır';
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
    opening_time = p_opening_time,
    closing_time = p_closing_time,
    onboarding_complete = true,
    active = false
  where id = v_bid;

  return json_build_object(
    'business_id', v_bid::text,
    'active', false,
    'onboarding_complete', true,
    'opening_time', case when p_opening_time is null then null else to_char(p_opening_time, 'HH24:MI:SS') end,
    'closing_time', case when p_closing_time is null then null else to_char(p_closing_time, 'HH24:MI:SS') end
  );
exception
  when unique_violation then
    raise exception 'Bu kısa adres zaten kullanılıyor';
end;
$$;

grant execute on function public.complete_business_onboarding(
  text, text, text, text, text, time, time
) to anon;
grant execute on function public.complete_business_onboarding(
  text, text, text, text, text, time, time
) to authenticated;

create or replace function public.complete_business_onboarding_google(
  p_business_name text,
  p_manager_name text,
  p_slug text,
  p_opening_time time default null,
  p_closing_time time default null
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

  if (p_opening_time is null) <> (p_closing_time is null) then
    raise exception 'Açılış ve kapanış saati birlikte girilmelidir';
  end if;

  if p_opening_time is not null and p_opening_time = p_closing_time then
    raise exception 'Açılış ve kapanış saatleri farklı olmalıdır';
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
    opening_time = p_opening_time,
    closing_time = p_closing_time,
    onboarding_complete = true,
    active = false
  where id = v_bid;

  return json_build_object(
    'business_id', v_bid::text,
    'active', false,
    'onboarding_complete', true,
    'opening_time', case when p_opening_time is null then null else to_char(p_opening_time, 'HH24:MI:SS') end,
    'closing_time', case when p_closing_time is null then null else to_char(p_closing_time, 'HH24:MI:SS') end
  );
exception
  when unique_violation then
    raise exception 'Bu kısa adres zaten kullanılıyor';
end;
$$;

grant execute on function public.complete_business_onboarding_google(
  text, text, text, time, time
) to authenticated;


create or replace function public.update_panel_business_profile(
  p_business_name text,
  p_manager_display_name text,
  p_slug text,
  p_username text default null,
  p_password text default null,
  p_opening_time time default null,
  p_closing_time time default null
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_bid uuid;
  v_hash text;
  uid uuid := auth.uid();
  v_slug text := lower(trim(p_slug));
begin
  if length(trim(p_business_name)) < 1 or length(trim(p_manager_display_name)) < 1 then
    raise exception 'İşletme adı ve yönetici adı gerekli';
  end if;

  if length(v_slug) < 2 or v_slug like 'pending-%' or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Geçersiz kısa adres';
  end if;

  if (p_opening_time is null) <> (p_closing_time is null) then
    raise exception 'Açılış ve kapanış saati birlikte girilmelidir ya da ikisi boş olmalıdır';
  end if;

  if p_opening_time is not null and p_opening_time = p_closing_time then
    raise exception 'Açılış ve kapanış saatleri farklı olmalıdır';
  end if;

  if uid is not null then
    select bu.business_id into v_bid
    from public.business_users bu
    where bu.auth_user_id = uid
    limit 1;
  end if;

  if v_bid is null then
    if p_username is null or length(trim(coalesce(p_password, ''))) < 8 then
      raise exception 'Oturum veya şifre gerekli';
    end if;

    select bu.business_id, bu.password_hash into v_bid, v_hash
    from public.business_users bu
    where lower(trim(bu.username)) = lower(trim(p_username))
    limit 1;

    if v_bid is null or v_hash is distinct from crypt(p_password, v_hash) then
      raise exception 'Kimlik doğrulanamadı';
    end if;
  end if;

  if exists (
    select 1
    from public.businesses b
    where b.slug = v_slug
      and b.id <> v_bid
  ) then
    raise exception 'Bu kısa adres zaten kullanılıyor';
  end if;

  update public.businesses
  set
    name = trim(p_business_name),
    manager_display_name = trim(p_manager_display_name),
    slug = v_slug,
    opening_time = p_opening_time,
    closing_time = p_closing_time
  where id = v_bid;

  return json_build_object(
    'business_id', v_bid::text,
    'name', trim(p_business_name),
    'manager_display_name', trim(p_manager_display_name),
    'slug', v_slug,
    'opening_time', case when p_opening_time is null then null else to_char(p_opening_time, 'HH24:MI:SS') end,
    'closing_time', case when p_closing_time is null then null else to_char(p_closing_time, 'HH24:MI:SS') end
  );
end;
$$;

grant execute on function public.update_panel_business_profile(
  text, text, text, text, text, time, time
) to anon;

grant execute on function public.update_panel_business_profile(
  text, text, text, text, text, time, time
) to authenticated;
