-- cafe_tables: Masa satırı silme (anon). SQL Editor'de bir kez çalıştırın.

grant delete on public.cafe_tables to anon;
grant delete on public.cafe_tables to authenticated;

drop policy if exists "cafe_tables_anon_delete" on public.cafe_tables;

create policy "cafe_tables_anon_delete"
  on public.cafe_tables for delete
  to anon
  using (true);
