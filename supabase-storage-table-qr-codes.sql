-- Masa QR kodları (PNG) — bucket + Storage RLS
-- Dashboard → Storage ile de oluşturulabilir; bu dosya tek seferlik SQL Editor çalıştırması içindir.

insert into storage.buckets (id, name, public)
values ('table-qr-codes', 'table-qr-codes', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "table_qr_select_clients" on storage.objects;
drop policy if exists "table_qr_insert_clients" on storage.objects;
drop policy if exists "table_qr_update_clients" on storage.objects;
drop policy if exists "table_qr_delete_clients" on storage.objects;

create policy "table_qr_select_clients"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'table-qr-codes');

create policy "table_qr_insert_clients"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'table-qr-codes');

create policy "table_qr_update_clients"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'table-qr-codes')
  with check (bucket_id = 'table-qr-codes');

create policy "table_qr_delete_clients"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'table-qr-codes');
