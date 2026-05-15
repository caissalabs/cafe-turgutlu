-- PARÇA 2 — Storage bucket kaydı (isteğe bağlı SQL)
--
-- UYARI: Aşağıdaki ALTER / CREATE POLICY satırları storage.objects üzerinde
-- çalıştırıldığında "must be owner of table objects" hatası verebilir.
-- O durumda bu dosyayı ÇALIŞTIRMAYIN; bunun yerine
-- supabase-custom-menu-KURULUM-ADIMLAR.md içindeki "Storage" adımlarını izleyin.
--
-- Yalnızca bucket satırı bazen SQL Editor'de çalışır. Çalışmazsa bucket'ı
-- Dashboard → Storage üzerinden oluşturun.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  3145728,
  array['image/png', 'image/jpeg']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
