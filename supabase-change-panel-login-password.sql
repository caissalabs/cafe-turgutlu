-- Kullanıcı adı / şifre ile giriş (Supabase oturumu olmadan): panel şifresini değiştirir.
-- Mevcut bcrypt doğrulanır; yeni şifre min 8 karakter.
--
-- Hesabım: Supabase oturumu varken şifre değişimi auth.updateUser + sync_business_user_password ile yapılır;
-- bu fonksiyon yalnızca anon kullanıcı adı oturumu için çağrılır.

create or replace function public.change_panel_login_password(
  p_username text,
  p_current_password text,
  p_new_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  n int;
  v_u text := trim(coalesce(p_username, ''));
begin
  if length(v_u) < 2 then
    raise exception 'Kullanıcı adı gerekli';
  end if;

  if length(trim(coalesce(p_new_password, ''))) < 8 then
    raise exception 'Şifre en az 8 karakter olmalıdır';
  end if;

  if length(trim(coalesce(p_current_password, ''))) < 8 then
    raise exception 'Mevcut şifre geçersiz';
  end if;

  select bu.password_hash
  into v_hash
  from public.business_users bu
  where lower(bu.username) = lower(v_u)
  limit 1;

  if v_hash is null then
    raise exception 'Kimlik doğrulanamadı';
  end if;

  if crypt(p_current_password, v_hash) is distinct from v_hash then
    raise exception 'Kimlik doğrulanamadı';
  end if;

  update public.business_users bu
  set password_hash = crypt(p_new_password, gen_salt('bf'))
  where lower(bu.username) = lower(v_u);

  get diagnostics n = row_count;
  if n < 1 then
    raise exception 'Kimlik doğrulanamadı';
  end if;
end;
$$;

grant execute on function public.change_panel_login_password(text, text, text) to anon;
