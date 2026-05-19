-- E-posta ile Supabase Auth zorunlu panel girişi + anon panel yazma izinlerini kapatma
-- Müşteri QR akışı (menü okuma + sipariş gönderme) anon ile çalışmaya devam eder.
-- SQL Editor'de bir kez çalıştırın.

-- ══════════════════════════════════════════════════════════════
-- 1. Kayıt: yalnızca e-posta + şifre (kullanıcı adı alanı kaldırıldı)
-- ══════════════════════════════════════════════════════════════

drop function if exists public.register_user(text, text);
drop function if exists public.register_user(text, text, text);

create or replace function public.register_user(p_email text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_mail text := lower(trim(p_email));
  v_user text;
  v_slug text;
begin
  if length(p_password) < 8 then
    raise exception 'Şifre en az 8 karakter olmalıdır';
  end if;

  if v_mail is null or length(v_mail) < 5 or position('@' in v_mail) < 2 then
    raise exception 'Geçerli bir e-posta adresi gerekli';
  end if;

  -- Dahili kullanıcı adı: e-posta (benzersiz index email üzerinde)
  v_user := v_mail;

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
    'username', v_user,
    'email', v_mail
  );
exception
  when unique_violation then
    raise exception 'Bu e-posta zaten kullanılıyor';
end;
$$;

grant execute on function public.register_user(text, text) to anon;
grant execute on function public.register_user(text, text) to authenticated;

-- Eski kullanıcı adı girişi kapat
revoke execute on function public.login_user(text, text) from anon;
revoke execute on function public.login_user(text, text) from authenticated;

revoke execute on function public.change_panel_login_password(text, text, text) from anon;
revoke execute on function public.change_panel_login_password(text, text, text) from authenticated;

-- Username ile onboarding kapat (auth.uid kullanan google sürümü kalır)
revoke execute on function public.complete_business_onboarding(text, text, text, text, text, time, time) from anon;
revoke execute on function public.complete_business_onboarding(text, text, text, text, text, time, time) from authenticated;

-- ══════════════════════════════════════════════════════════════
-- 2. Panel: authenticated kullanıcı kendi işletmesini okuyabilsin
-- ══════════════════════════════════════════════════════════════

drop policy if exists "businesses_authenticated_select" on public.businesses;
create policy "businesses_authenticated_select"
  on public.businesses for select
  to authenticated
  using (id = public.get_business_id_for_auth_user());

-- ══════════════════════════════════════════════════════════════
-- 3. Anon panel yazma izinlerini kaldır (müşteri SELECT + sipariş INSERT kalır)
-- ══════════════════════════════════════════════════════════════

-- cafe_menu_categories
drop policy if exists "cafe_menu_categories_anon_insert_active" on public.cafe_menu_categories;
drop policy if exists "cafe_menu_categories_anon_update_active" on public.cafe_menu_categories;
drop policy if exists "cafe_menu_categories_anon_delete_active" on public.cafe_menu_categories;
revoke insert, update, delete on public.cafe_menu_categories from anon;

-- cafe_menu_items
drop policy if exists "cafe_menu_items_anon_insert_active" on public.cafe_menu_items;
drop policy if exists "cafe_menu_items_anon_update_active" on public.cafe_menu_items;
drop policy if exists "cafe_menu_items_anon_delete_active" on public.cafe_menu_items;
revoke insert, update, delete on public.cafe_menu_items from anon;

-- cafe_tables
drop policy if exists "cafe_tables_anon_insert_active" on public.cafe_tables;
drop policy if exists "cafe_tables_anon_update_active" on public.cafe_tables;
drop policy if exists "cafe_tables_anon_delete_active" on public.cafe_tables;
revoke insert, update, delete on public.cafe_tables from anon;

-- cafe_orders: müşteri INSERT + SELECT; panel UPDATE/DELETE authenticated
drop policy if exists "cafe_orders_anon_update_active" on public.cafe_orders;
drop policy if exists "cafe_orders_anon_delete_active" on public.cafe_orders;
revoke update, delete on public.cafe_orders from anon;

-- cafe_payment_history: yalnızca authenticated panel
drop policy if exists "cafe_payment_history_anon_select_active" on public.cafe_payment_history;
drop policy if exists "cafe_payment_history_anon_insert_active" on public.cafe_payment_history;
revoke select, insert on public.cafe_payment_history from anon;

-- Storage: anon yazma kapat
drop policy if exists "menu_images_insert_anon_active" on storage.objects;
drop policy if exists "menu_images_update_anon_active" on storage.objects;
drop policy if exists "table_qr_insert_anon_active" on storage.objects;
drop policy if exists "table_qr_update_anon_active" on storage.objects;
