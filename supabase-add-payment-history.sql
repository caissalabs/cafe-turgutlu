-- Ödeme geçmişi: masada "ödeme alındı" ile kapatılan hesapların kaydı.
-- SQL Editor'de bir kez çalıştırın. cafe_orders ve businesses zaten var olmalı.
--
-- Not: Mevcut projede diğer cafe_* tablolarıyla aynı MVP güvenlik modeli (anon SELECT+INSERT).
-- Üretimde RLS'yi işletme bazlı sıkılaştırın veya service_role kullanın.

create table if not exists public.cafe_payment_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  table_number int not null check (table_number >= 1 and table_number <= 50),
  table_display_name text,
  total_try numeric(12, 2) not null,
  order_count int not null check (order_count >= 1),
  lines jsonb not null default '[]'::jsonb,
  paid_at timestamptz not null default now()
);

create index if not exists cafe_payment_history_business_paid_idx
  on public.cafe_payment_history (business_id, paid_at desc);

alter table public.cafe_payment_history enable row level security;

grant select, insert on public.cafe_payment_history to anon;
grant select, insert on public.cafe_payment_history to authenticated;
grant all on public.cafe_payment_history to service_role;

drop policy if exists "cafe_payment_history_anon_select" on public.cafe_payment_history;
create policy "cafe_payment_history_anon_select"
  on public.cafe_payment_history for select
  to anon
  using (true);

drop policy if exists "cafe_payment_history_anon_insert" on public.cafe_payment_history;
create policy "cafe_payment_history_anon_insert"
  on public.cafe_payment_history for insert
  to anon
  with check (true);

drop policy if exists "cafe_payment_history_authenticated_select" on public.cafe_payment_history;
create policy "cafe_payment_history_authenticated_select"
  on public.cafe_payment_history for select
  to authenticated
  using (true);

drop policy if exists "cafe_payment_history_authenticated_insert" on public.cafe_payment_history;
create policy "cafe_payment_history_authenticated_insert"
  on public.cafe_payment_history for insert
  to authenticated
  with check (true);

-- Realtime (tablo zaten yayında ise hata verebilir — yok sayılabilir)
alter publication supabase_realtime add table public.cafe_payment_history;
