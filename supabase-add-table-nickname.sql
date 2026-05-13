-- cafe_tables: nickname sütunu + name alanı her zaman "Masa {id}" olacak şekilde normalize.
-- SQL Editor'de bir kez çalıştırın.

alter table public.cafe_tables
  add column if not exists nickname text;

-- Eski özelleştirilmiş isimleri takma ada taşı (name artık sadece Masa + no)
update public.cafe_tables
set nickname = trim(name)
where trim(name) is distinct from ('Masa ' || id::text);

update public.cafe_tables
set name = 'Masa ' || id::text;

comment on column public.cafe_tables.name is 'Sabit QR kimliği metni: Masa {id}';
comment on column public.cafe_tables.nickname is 'İsteğe bağlı görünen takma ad; boşsa name gösterilir';
