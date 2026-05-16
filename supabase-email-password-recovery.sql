-- E-posta ile şifreli kayıt + Supabase Auth bağlantısı + şifre sıfırlama uyumu
-- SQL Editor'de bir kez çalıştırın.
--
-- Önkoşullar: supabase-onboarding-active-flow.sql uygulanmış olmalı.
-- Dashboard → Authentication:
--   - E-posta doğrulaması kapalı önerilir (panel kaydı sonrası anında oturum için).
--   - Redirect URLs: .../auth/callback, .../auth/sifre-yenile
--
-- Açıklama: register_user işletme satırını oluşturur; istemci ardından auth.signUp ile
-- auth.users kaydı açar ve link_password_panel_to_auth ile business_users.auth_user_id bağlar.
-- Şifre sıfırlama (resetPasswordForEmail) yalnızca auth.users için çalışır; bcrypt yedeği için
-- istemci sync_business_user_password RPC çağırır.

alter table public.business_users
  add column if not exists email text;

create unique index if not exists business_users_email_lower_uq
  on public.business_users (lower(trim(email)))
  where email is not null and trim(email) <> '';

-- Eski iki parametreli kayıt (varsa) kaldırılır; tek imza kullanılır.
drop function if exists public.register_user(text, text);

create or replace function public.register_user(p_username text, p_password text, p_email text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_user text := lower(trim(p_username));
  v_slug text;
  v_mail text := lower(trim(p_email));
begin
  if length(v_user) < 2 or length(p_password) < 8 then
    raise exception 'Geçersiz kullanıcı adı veya şifre (şifre en az 8 karakter)';
  end if;

  if v_mail is null or length(v_mail) < 5 or position('@' in v_mail) < 2 then
    raise exception 'Geçerli bir e-posta adresi gerekli';
  end if;

  v_slug := 'pending-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.businesses (name, slug, active, onboarding_complete, manager_display_name)
  values ('', v_slug, false, false, '')
  returning id into v_id;

  insert into public.business_users (business_id, username, password_hash, email)
  values (v_id, v_user, crypt(p_password, gen_salt('bf')), v_mail);

  perform public.seed_default_tables_for_business(v_id);

  return json_build_object(
    'business_id', v_id::text,
    'active', false,
    'onboarding_complete', false,
    'username', v_user
  );
exception
  when unique_violation then
    raise exception 'Bu kullanıcı adı veya e-posta zaten kullanılıyor';
end;
$$;

grant execute on function public.register_user(text, text, text) to anon;
grant execute on function public.register_user(text, text, text) to authenticated;

-- Oturum açmış auth kullanıcısını (signUp sonrası) panel satırına bağlar.
create or replace function public.link_password_panel_to_auth(p_username text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mail text;
  v_uid uuid := auth.uid();
  v_bid uuid;
  v_active boolean;
  v_oc boolean;
  v_user_row text;
begin
  if v_uid is null then
    raise exception 'Oturum gerekli';
  end if;

  select au.email into v_mail
  from auth.users au
  where au.id = v_uid;

  if v_mail is null or trim(v_mail) = '' then
    raise exception 'Oturum hesabında e-posta bulunamadı';
  end if;

  update public.business_users bu
  set auth_user_id = v_uid
  where lower(trim(bu.username)) = lower(trim(p_username))
    and lower(trim(bu.email)) = lower(trim(v_mail))
    and bu.auth_user_id is null
  returning bu.business_id into v_bid;

  if v_bid is null then
    raise exception 'Panel kaydı bağlanamadı; kullanıcı adı ve e-posta eşleşmesini kontrol edin.';
  end if;

  select b.active, b.onboarding_complete, bu.username
    into v_active, v_oc, v_user_row
  from public.business_users bu
  join public.businesses b on b.id = bu.business_id
  where bu.business_id = v_bid
    and bu.auth_user_id = v_uid
  limit 1;

  return json_build_object(
    'business_id', v_bid::text,
    'active', coalesce(v_active, false),
    'onboarding_complete', coalesce(v_oc, false),
    'username', v_user_row
  );
end;
$$;

grant execute on function public.link_password_panel_to_auth(text) to authenticated;

-- Auth şifresi değişince (kurtarma dahil) bcrypt kopyasını günceller — eksik onboarding doğrulaması için.
create or replace function public.sync_business_user_password(p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  if length(p_password) < 8 then
    raise exception 'Şifre en az 8 karakter olmalıdır';
  end if;

  update public.business_users
  set password_hash = crypt(p_password, gen_salt('bf'))
  where auth_user_id = uid;

  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'İşletme kullanıcısı bulunamadı';
  end if;
end;
$$;

grant execute on function public.sync_business_user_password(text) to authenticated;
