-- Mevcut projede register_business fonksiyonu zaten varsa ve şifre alt sınırını 8 yapmak istiyorsanız
-- Supabase SQL Editor'de bir kez çalıştırın (supabase-fix-pgcrypto-login.sql ile aynı gövde).

create extension if not exists pgcrypto with schema extensions;

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

grant execute on function public.register_business(text, text, text, text) to anon;
grant execute on function public.register_business(text, text, text, text) to authenticated;
