-- PARÇA 1 — Genel şema (SQL Editor'de çalıştırın, sorunsuz olmalı)
-- Menü tabloları, RLS, Realtime publication.
-- Publication zaten ekliyse ilgili satırlar hata verebilir — o satırları yorum satırı yapıp devam edin.

-- ── Tablolar ──
create table if not exists public.cafe_menu_categories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  sort_order int not null default 0
);

create table if not exists public.cafe_menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.cafe_menu_categories (id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(12, 2) not null check (price >= 0),
  allergens text[] not null default '{}',
  image_url text,
  sort_order int not null default 0
);

create index if not exists cafe_menu_items_category_sort_idx
  on public.cafe_menu_items (category_id, sort_order, name);

alter table public.cafe_menu_categories enable row level security;
alter table public.cafe_menu_items enable row level security;

grant select, insert, update, delete on public.cafe_menu_categories to anon;
grant select, insert, update, delete on public.cafe_menu_categories to authenticated;
grant select, insert, update, delete on public.cafe_menu_items to anon;
grant select, insert, update, delete on public.cafe_menu_items to authenticated;
grant all on public.cafe_menu_categories to service_role;
grant all on public.cafe_menu_items to service_role;

drop policy if exists "cafe_menu_categories_anon_all" on public.cafe_menu_categories;
create policy "cafe_menu_categories_anon_all"
  on public.cafe_menu_categories for all
  to anon
  using (true)
  with check (true);

drop policy if exists "cafe_menu_items_anon_all" on public.cafe_menu_items;
create policy "cafe_menu_items_anon_all"
  on public.cafe_menu_items for all
  to anon
  using (true)
  with check (true);

alter publication supabase_realtime add table public.cafe_menu_categories;
alter publication supabase_realtime add table public.cafe_menu_items;

comment on table public.cafe_menu_categories is 'Özel menü kategorileri';
comment on table public.cafe_menu_items is 'Özel menü ürünleri; görsel URL storage public yolu';
comment on column public.cafe_menu_items.allergens is 'Ürün alerjen etiketleri (metin dizisi)';
comment on column public.cafe_menu_items.image_url is 'menu-images bucket public URL veya yerel modda data URL';
