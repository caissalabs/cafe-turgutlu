-- Daha önce eski supabase-schema.sql çalıştırdıysanız: masa sıfırlama için DELETE izni ekler.
-- SQL Editor'de bir kez çalıştırın.

grant delete on public.cafe_orders to anon;
grant delete on public.cafe_orders to authenticated;

drop policy if exists "cafe_orders_anon_delete" on public.cafe_orders;

create policy "cafe_orders_anon_delete"
  on public.cafe_orders for delete
  to anon
  using (true);
