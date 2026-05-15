-- menu-images bucket: Storage RLS politikaları (anon + authenticated)
--
-- Uygulama tarayıcıda yalnızca anon anahtar kullanıyor; görselleri otomatik
-- yüklemek için storage.objects üzerinde INSERT (ve güncelleme/silme için
-- UPDATE/DELETE) şart. Aksi halde:
--   "new row violates row-level security policy"
--
-- Supabase → SQL Editor → bu dosyayı yapıştırıp Run.
-- Önce bucket'ın var olduğundan emin olun (supabase-custom-menu-part2-storage.sql
-- veya Dashboard → Storage ile).

-- Önceki çalıştırmalarda aynı isimli policy varsa kaldır
drop policy if exists "menu_images_select_clients" on storage.objects;
drop policy if exists "menu_images_insert_clients" on storage.objects;
drop policy if exists "menu_images_update_clients" on storage.objects;
drop policy if exists "menu_images_delete_clients" on storage.objects;

-- Public URL ile okuma (API tarafı; bucket zaten public)
create policy "menu_images_select_clients"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'menu-images');

create policy "menu_images_insert_clients"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'menu-images');

create policy "menu_images_update_clients"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'menu-images')
  with check (bucket_id = 'menu-images');

create policy "menu_images_delete_clients"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'menu-images');
