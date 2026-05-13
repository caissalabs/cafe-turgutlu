-- Siparişleri masalar arası taşıma + yeni masa satırı ekleme (anon).
-- SQL Editor'de bir kez çalıştırın.

-- ── cafe_orders: UPDATE (aktarım) ──
grant update on public.cafe_orders to anon;
grant update on public.cafe_orders to authenticated;

drop policy if exists "cafe_orders_anon_update" on public.cafe_orders;

create policy "cafe_orders_anon_update"
  on public.cafe_orders for update
  to anon
  using (true)
  with check (true);

-- ── cafe_tables: INSERT (yeni masa) ──
grant insert on public.cafe_tables to anon;
grant insert on public.cafe_tables to authenticated;

drop policy if exists "cafe_tables_anon_insert" on public.cafe_tables;

create policy "cafe_tables_anon_insert"
  on public.cafe_tables for insert
  to anon
  with check (true);
