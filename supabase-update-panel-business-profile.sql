-- Panel «Hesabım»: işletme adı, yönetici görünen adı ve kısa adres (slug) güncelleme.
-- Kullanıcı adı, e-posta ve şifre bu fonksiyonla değiştirilmez.
--
-- Önce auth.uid() ile business_users.auth_user_id eşleşmesi denenir (OAuth / e-posta oturumu).
-- Eşleşme yoksa p_username + p_password ile doğrulama yapılır (yalnızca kullanıcı adı ile giriş).
--
-- SQL Editor'de bir kez çalıştırın.

create or replace function public.update_panel_business_profile(
  p_business_name text,
  p_manager_display_name text,
  p_slug text,
  p_username text default null,
  p_password text default null
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
    slug = v_slug
  where id = v_bid;

  return json_build_object(
    'business_id', v_bid::text,
    'name', trim(p_business_name),
    'manager_display_name', trim(p_manager_display_name),
    'slug', v_slug
  );
end;
$$;

grant execute on function public.update_panel_business_profile(text, text, text, text, text) to anon;
grant execute on function public.update_panel_business_profile(text, text, text, text, text) to authenticated;
