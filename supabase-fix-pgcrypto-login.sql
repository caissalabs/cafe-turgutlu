-- Girişte "function crypt(text, text) does not exist" (42883) hatası
-- -------------------------------------------------------------
-- Nedeni: Supabase'te pgcrypto genelde "extensions" şemasındadır.
-- login_business / register_business fonksiyonları yalnızca search_path=public
-- ile çalışınca crypt() ve gen_salt() görünmez.
--
-- Supabase SQL Editor'de bu dosyayı bir kez çalıştırın.

create extension if not exists pgcrypto with schema extensions;

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
declare
  v_id uuid;
  v_slug text := lower(trim(p_slug));
  v_user text := lower(trim(p_username));
begin
  if length(v_slug) < 2 or length(v_user) < 2 or length(p_password) < 8 then
    raise exception 'Geçersiz işletme, kullanıcı adı veya şifre (şifre en az 8 karakter)';
  end if;
  insert into public.businesses (name, slug)
  values (trim(p_name), v_slug)
  returning id into v_id;

  insert into public.business_users (business_id, username, password_hash)
  values (v_id, v_user, crypt(p_password, gen_salt('bf')));
  return v_id;
exception
  when unique_violation then
    raise exception 'Bu kısa ad veya kullanıcı adı zaten kullanılıyor';
end;
$$;

grant execute on function public.login_business(text, text, text) to anon;
grant execute on function public.login_business(text, text, text) to authenticated;
grant execute on function public.register_business(text, text, text, text) to anon;
grant execute on function public.register_business(text, text, text, text) to authenticated;
