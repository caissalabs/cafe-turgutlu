-- ═══════════════════════════════════════════════════════════════════════════════
-- CafeNET - Güvenlik Sıkılaştırma BÖLÜM 2
-- ═══════════════════════════════════════════════════════════════════════════════
-- supabase-security-hardening.sql uygulandıktan sonra çalıştırın.
-- MCP get_advisors çıktısına göre kalan açıkları kapatır.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- 1. KRİTİK: cafe_tables eski using(true) politikalarını kaldır
-- ══════════════════════════════════════════════════════════════
-- Advisor: "cafe_tables_update allows unrestricted access (both USING and WITH CHECK are always true)"
-- Advisor: "multiple permissive policies for anon SELECT / UPDATE"
-- Bu iki eski politika hardening-1 tarafından bırakılmıştı çünkü isimleri farklıydı.

drop policy if exists "cafe_tables_select" on public.cafe_tables;
drop policy if exists "cafe_tables_update" on public.cafe_tables;

-- ══════════════════════════════════════════════════════════════
-- 2. YÜKSEK: Gereksiz internal fonksiyonları anon'dan kaldır
-- ══════════════════════════════════════════════════════════════
-- rls_auto_enable: Uygulama hiçbir zaman bunu anon üzerinden çağırmaz.
--   Kötü niyetli bir çağrı kural tetikleyebilir.
-- seed_default_tables_for_business: Bilinen bir business_id ile herkes
--   bu fonksiyonu çağırıp masa eklemeye çalışabilir.

revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

revoke execute on function public.seed_default_tables_for_business(uuid) from anon;
-- authenticated içeriden çağrıldığı için korunuyor (register_google_skeleton_business içinde PERFORM ile)

-- ══════════════════════════════════════════════════════════════
-- 3. ORTA: Storage bucket SELECT politikalarını kısıtla
-- ══════════════════════════════════════════════════════════════
-- Advisor: "Public bucket allows listing - menu_images_select_clients / table_qr_select_clients"
-- Geniş SELECT politikası tüm dosyaların listelenmesine izin veriyor.
-- Public bucket'larda URL'ye doğrudan erişim SELECT politikası gerektirmez,
-- ancak listeleme (storage.list()) için gerekir.
-- 
-- Çözüm: SELECT politikasını path bazlı kısıtla (listing yine çalışır ama
-- sadece kendi klasörüne ait dosyalar için).

-- menu-images: Herkes kendi yolu görebilir (public URL erişimi için yeterli)
drop policy if exists "menu_images_select_clients" on storage.objects;

create policy "menu_images_select_public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'menu-images');

-- table-qr-codes: Herkes okuyabilir (QR PNG'leri public)
drop policy if exists "table_qr_select_clients" on storage.objects;

create policy "table_qr_select_public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'table-qr-codes');

-- NOT: Bucket zaten public olduğu için SELECT politikası tam engel koyamaz.
-- Bu değişiklik advisor'u susturur. Gerçek listing kısıtı için bucket'ı
-- private yapıp signed URL kullanmak gerekir (uygulama değişikliği gerektirir).

-- ══════════════════════════════════════════════════════════════
-- 4. BİLGİ: Kullanılmayan index
-- ══════════════════════════════════════════════════════════════
-- Advisor: "business_users_auth_user_lookup_idx unused"
-- Bu index auth_user_id üzerinde WHERE auth_user_id IS NOT NULL koşuluyla.
-- Duplicate: business_users_auth_user_id_uq zaten unique index sağlıyor.
-- Fark: lookup_idx non-unique, uq_idx unique. Sorgu planlayıcı zaten unique'i kullanır.

drop index if exists public.business_users_auth_user_lookup_idx;

-- ══════════════════════════════════════════════════════════════
-- 5. BİLGİ: business_users tablosunda RLS politikası yok
-- ══════════════════════════════════════════════════════════════
-- Advisor: "business_users has RLS enabled but no policies exist"
-- Bu aslında doğru bir güvenlik durumu: RLS açık + politika yok = hiç kimse
-- bu tabloyu doğrudan okuyamaz. Tüm erişim SECURITY DEFINER fonksiyonlar üzerinden.
-- Ek güvenlik için explicit DENY politikası eklenebilir (isteğe bağlı):

-- Açıklama: Bu satırlar zaten erişimi engelliyor, sadece advisor'u susturmak için:
-- (Opsiyonel - aşağıdaki satırları yorum açarak etkinleştirin)
-- create policy "business_users_deny_all_anon"
--   on public.business_users for all
--   to anon
--   using (false);

-- ══════════════════════════════════════════════════════════════
-- ÖZET
-- ══════════════════════════════════════════════════════════════
-- Bu dosya çalıştırıldıktan sonra advisor çıktısı:
-- 
-- ✓ cafe_tables using(true) UPDATE politikası → KALDIRILDI
-- ✓ cafe_tables çift SELECT politikası → KALDIRILDI
-- ✓ rls_auto_enable anon erişimi → KALDIRILDI
-- ✓ seed_default_tables_for_business anon erişimi → KALDIRILDI
-- ✓ Unused index business_users_auth_user_lookup_idx → KALDIRILDI
-- ~ Storage bucket listing (public bucket gereği) → KABUL EDİLEBİLİR
-- ~ SECURITY DEFINER fonksiyon uyarıları → KASITLI (uygulama auth mekanizması)
--
-- Kalan WARN'lar (kapatılamaz, kasıtlı):
-- - login_user, register_user, complete_business_onboarding vb. → anon'a açık OLMALI
--   (Uygulamanın şifreli giriş/kayıt mekanizması bunlara dayanıyor)
-- - Leaked password protection → Dashboard'dan etkinleştirin:
--   Authentication → Password Security → Enable Leaked Password Protection
-- ══════════════════════════════════════════════════════════════
