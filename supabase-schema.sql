-- Cafe Turgutlu — Supabase SQL Editor'de bir kez çalıştırın.
-- Projeyi oluşturduktan sonra: SQL Editor → New query → yapıştır → Run.
--
-- Güvenlik: anon için INSERT+SELECT+DELETE küçük işletme MVP içindir (masa sıfırlama); kötüye kullanıma karşı
-- ileride Edge Function veya service_role ile sıkılaştırın.

create table if not exists public.cafe_orders (
  id uuid primary key default gen_random_uuid(),
  table_number int not null check (table_number >= 1 and table_number <= 50),
  lines jsonb not null default '[]'::jsonb,
  total_try numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

alter table public.cafe_orders enable row level security;

grant select, insert, delete on public.cafe_orders to anon;
grant select, insert, delete on public.cafe_orders to authenticated;
grant all on public.cafe_orders to service_role;

create policy "cafe_orders_anon_insert"
  on public.cafe_orders for insert
  to anon
  with check (true);

create policy "cafe_orders_anon_select"
  on public.cafe_orders for select
  to anon
  using (true);

create policy "cafe_orders_anon_delete"
  on public.cafe_orders for delete
  to anon
  using (true);

-- Realtime: tablo zaten yayına ekliyse bu satır hata verebilir — Dashboard → Database → Publications ile kontrol edin.
alter publication supabase_realtime add table public.cafe_orders;
