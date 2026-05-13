-- cafe_tables: Masa isimlerini saklar.
-- SQL Editor'de bir kez çalıştırın.
--
-- nickname sütunu ve name normalizasyonu için ayrıca şunu çalıştırın:
--   supabase-add-table-nickname.sql

create table if not exists public.cafe_tables (
  id   integer primary key check (id >= 1 and id <= 50),
  name text    not null
);

alter table public.cafe_tables enable row level security;

grant select, update on public.cafe_tables to anon;
grant select, update on public.cafe_tables to authenticated;
grant all                on public.cafe_tables to service_role;

-- Herkes okuyabilir
create policy "cafe_tables_select"
  on public.cafe_tables for select
  to anon
  using (true);

-- Herkes güncelleyebilir (küçük işletme MVP — gerekirse sıkılaştırın)
create policy "cafe_tables_update"
  on public.cafe_tables for update
  to anon
  using (true)
  with check (true);

-- Varsayılan 10 masa satırı (yoksa ekle)
insert into public.cafe_tables (id, name)
select n, 'Masa ' || n
from generate_series(1, 10) as n
on conflict (id) do nothing;
