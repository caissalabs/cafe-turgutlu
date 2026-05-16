-- Supabase SQL Editor: Varsayılan işletmedeki örnek "admin" hesabını kaldırır.
-- Yeni kurulumlarda supabase-multi-tenant-businesses.sql artık bu kullanıcıyı oluşturmaz.
delete from public.business_users
where business_id = 'a0000000-0000-4000-8000-000000000001'
  and lower(trim(username)) = 'admin';
