-- Google OAuth (Supabase Auth) ile işletme bağlantısı
-- Ön koşul: Dashboard → Authentication → Providers içinde Google açık;
-- Site URL ve Redirect URL listesine şunları ekleyin:
--   http://localhost:5173/auth/callback   (geliştirme)
--   https://<domain>/auth/callback       (üretim)

alter table public.business_users
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

create unique index if not exists business_users_auth_user_id_uq
  on public.business_users (auth_user_id)
  where auth_user_id is not null;

create index if not exists business_users_auth_user_lookup_idx
  on public.business_users (auth_user_id)
  where auth_user_id is not null;

-- Oturum açık Supabase kullanıcısının bağlı olduğu işletme kimliği (tek işletme varsayımı)
create or replace function public.get_business_id_for_auth_user()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id
  from public.business_users
  where auth_user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.get_business_id_for_auth_user() to authenticated;

-- Google ile ilk kayıt: JWT kullanıcısı için işletme + tek satır business_users (şifre alanı yer tutucu)
create or replace function public.register_business_with_google(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_slug text := lower(trim(p_slug));
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  if exists (select 1 from public.business_users where auth_user_id = uid) then
    raise exception 'Bu Google hesabı zaten bir işletmeye bağlı';
  end if;
  if length(trim(p_name)) < 1 or length(v_slug) < 2 then
    raise exception 'Geçersiz işletme veya kısa adres';
  end if;

  insert into public.businesses (name, slug)
  values (trim(p_name), v_slug)
  returning id into v_id;

  insert into public.business_users (business_id, username, password_hash, auth_user_id)
  values (v_id, 'google', crypt(gen_random_uuid()::text, gen_salt('bf')), uid);

  return v_id;
exception
  when unique_violation then
    raise exception 'Bu kısa adres zaten kullanılıyor';
end;
$$;

grant execute on function public.register_business_with_google(text, text) to authenticated;
