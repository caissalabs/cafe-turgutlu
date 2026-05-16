-- Google OAuth ile giriş: JWT rolü "authenticated" olur. cafe_* politikaları yalnızca "anon"
-- ise masa/menü/sipariş yazımları 42501 (RLS) ile reddedilir.
-- Şifreli giriş anon JWT kullanmaya devam eder; mevcut anon politikaları aynen kalır.
--
-- ÖNEMLİ — QR menü müşterisi (sipariş veren):
-- Bu dosya yalnızca TO authenticated politikaları ekler; mevcut anon politikalarına
-- DROP/ALTER yapmaz. Müşteri tarayıcısı giriş yapmaz (anon anahtar); RLS’te rol anon
-- olduğu için cafe_orders_anon_* vb. kurallar eskisi gibi geçerlidir — sipariş insert’i
-- anon için açık kalır (supabase-schema.sql + güncellemelerinizde tanımlı olduğu gibi).
--
-- Önkoşul: supabase-multi-tenant-businesses.sql içindeki public.get_business_id_for_auth_user()
-- tanımlı olmalı.
--
-- SQL Editor'de bir kez çalıştırın.

-- ── cafe_tables ─────────────────────────────────────────────

drop policy if exists "cafe_tables_authenticated_select" on public.cafe_tables;
create policy "cafe_tables_authenticated_select"
  on public.cafe_tables for select
  to authenticated
  using (business_id = public.get_business_id_for_auth_user());

drop policy if exists "cafe_tables_authenticated_insert" on public.cafe_tables;
create policy "cafe_tables_authenticated_insert"
  on public.cafe_tables for insert
  to authenticated
  with check (business_id = public.get_business_id_for_auth_user());

drop policy if exists "cafe_tables_authenticated_update" on public.cafe_tables;
create policy "cafe_tables_authenticated_update"
  on public.cafe_tables for update
  to authenticated
  using (business_id = public.get_business_id_for_auth_user())
  with check (business_id = public.get_business_id_for_auth_user());

drop policy if exists "cafe_tables_authenticated_delete" on public.cafe_tables;
create policy "cafe_tables_authenticated_delete"
  on public.cafe_tables for delete
  to authenticated
  using (business_id = public.get_business_id_for_auth_user());

-- ── cafe_menu_categories ────────────────────────────────────

drop policy if exists "cafe_menu_categories_authenticated_all" on public.cafe_menu_categories;
create policy "cafe_menu_categories_authenticated_all"
  on public.cafe_menu_categories for all
  to authenticated
  using (business_id = public.get_business_id_for_auth_user())
  with check (business_id = public.get_business_id_for_auth_user());

-- ── cafe_menu_items ─────────────────────────────────────────

drop policy if exists "cafe_menu_items_authenticated_all" on public.cafe_menu_items;
create policy "cafe_menu_items_authenticated_all"
  on public.cafe_menu_items for all
  to authenticated
  using (business_id = public.get_business_id_for_auth_user())
  with check (business_id = public.get_business_id_for_auth_user());

-- ── cafe_orders (panel / oauth kullanıcıları) ───────────────
-- Anon müşteri siparişi: ayrı politikalar (cafe_orders_anon_*) — dokunulmadı.

drop policy if exists "cafe_orders_authenticated_select" on public.cafe_orders;
create policy "cafe_orders_authenticated_select"
  on public.cafe_orders for select
  to authenticated
  using (business_id = public.get_business_id_for_auth_user());

drop policy if exists "cafe_orders_authenticated_insert" on public.cafe_orders;
create policy "cafe_orders_authenticated_insert"
  on public.cafe_orders for insert
  to authenticated
  with check (business_id = public.get_business_id_for_auth_user());

drop policy if exists "cafe_orders_authenticated_update" on public.cafe_orders;
create policy "cafe_orders_authenticated_update"
  on public.cafe_orders for update
  to authenticated
  using (business_id = public.get_business_id_for_auth_user())
  with check (business_id = public.get_business_id_for_auth_user());

drop policy if exists "cafe_orders_authenticated_delete" on public.cafe_orders;
create policy "cafe_orders_authenticated_delete"
  on public.cafe_orders for delete
  to authenticated
  using (business_id = public.get_business_id_for_auth_user());
