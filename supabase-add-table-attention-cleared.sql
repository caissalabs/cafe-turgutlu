-- Personel "sipariş hazırlandı" zamanını saklar; tüm cihazlarda aynı dikkat/bildirim mantığı.
-- SQL Editor'de bir kez çalıştırın.
--
-- Realtime: tablo zaten yayına ekliyse bu satır hata verebilir — Dashboard → Database → Publications.

alter table public.cafe_tables
  add column if not exists last_order_attention_cleared_at timestamptz;

-- Mevcut masalar: kurulum anına kadar gelen siparişleri tek seferde "yeni sipariş" saydırma
update public.cafe_tables
set last_order_attention_cleared_at = now()
where last_order_attention_cleared_at is null;

comment on column public.cafe_tables.last_order_attention_cleared_at is
  'Personelin bu masada siparişi hazır bildirdiği son an; bundan sonra oluşan siparişler dikkat ve bildirim ister.';

alter publication supabase_realtime add table public.cafe_tables;
