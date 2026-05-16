-- Çok kiracılı işletmeler: businesses + giriş (pgcrypto) + tüm cafe_* tablolarına business_id.
-- SQL Editor'de bir kez çalıştırın. Mevcut veriyi "Varsayılan işletme" altında toplar.
--
-- Varsayılan işletme UUID (mevcut tek işletmeli veriyi bağlamak için):
--   a0000000-0000-4000-8000-000000000001
-- İlk hesap: uygulama üzerinden "Kayıt" ile oluşturun (örnek admin/123 yok).
--
-- Supabase: pgcrypto "extensions" şemasındadır. security definer fonksiyonlarda
-- yalnızca search_path=public kullanılırsa crypt() bulunamaz (42883).

create extension if not exists pgcrypto with schema extensions;

-- ── İşletme ve yönetici hesabı ──
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.business_users (
  business_id uuid not null references public.businesses (id) on delete cascade,
  username text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  primary key (business_id, username)
);

create index if not exists business_users_business_idx on public.business_users (business_id);

alter table public.businesses enable row level security;
alter table public.business_users enable row level security;

grant select on public.businesses to anon;
grant select on public.business_users to anon;
grant all on public.businesses to service_role;
grant all on public.business_users to service_role;

drop policy if exists "businesses_anon_select" on public.businesses;
create policy "businesses_anon_select"
  on public.businesses for select
  to anon
  using (true);

revoke select on public.business_users from anon;

create or replace function public.login_business(p_slug text, p_username text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_bid uuid;
  v_hash text;
begin
  select bu.business_id, bu.password_hash into v_bid, v_hash
  from public.business_users bu
  inner join public.businesses b on b.id = bu.business_id
  where b.slug = lower(trim(p_slug))
    and lower(trim(bu.username)) = lower(trim(p_username));
  if v_bid is null then
    return null;
  end if;
  if v_hash = crypt(p_password, v_hash) then
    return v_bid;
  end if;
  return null;
end;
$$;

grant execute on function public.login_business(text, text, text) to anon;
grant execute on function public.login_business(text, text, text) to authenticated;

create or replace function public.resolve_business_id_by_slug(p_slug text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.businesses where slug = lower(trim(p_slug)) limit 1;
$$;

grant execute on function public.resolve_business_id_by_slug(text) to anon;
grant execute on function public.resolve_business_id_by_slug(text) to authenticated;

-- Yeni işletme + ilk admin (anon ile çağrılabilir — kötüye kullanım riski; üretimde kapatın veya Edge Function kullanın)
create or replace function public.register_business(
  p_name text,
  p_slug text,
  p_username text,
  p_password text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_slug text := lower(trim(p_slug));
  v_user text := lower(trim(p_username));
begin
  if length(v_slug) < 2 or length(v_user) < 2 or length(p_password) < 8 then
    raise exception 'Geçersiz işletme, kullanıcı adı veya şifre (şifre en az 8 karakter)';
  end if;
  insert into public.businesses (name, slug)
  values (trim(p_name), v_slug)
  returning id into v_id;

  insert into public.business_users (business_id, username, password_hash)
  values (v_id, v_user, crypt(p_password, gen_salt('bf')));
  return v_id;
exception
  when unique_violation then
    raise exception 'Bu kısa ad veya kullanıcı adı zaten kullanılıyor';
end;
$$;

grant execute on function public.register_business(text, text, text, text) to anon;
grant execute on function public.register_business(text, text, text, text) to authenticated;

-- ── Varsayılan işletme (mevcut veriyi buraya bağlar) ──
insert into public.businesses (id, name, slug)
values (
  'a0000000-0000-4000-8000-000000000001',
  'Varsayılan işletme',
  'default'
)
on conflict (slug) do nothing;

-- ── business_id sütunları ──
alter table public.cafe_tables
  add column if not exists business_id uuid references public.businesses (id) on delete cascade;

alter table public.cafe_orders
  add column if not exists business_id uuid references public.businesses (id) on delete cascade;

alter table public.cafe_menu_categories
  add column if not exists business_id uuid references public.businesses (id) on delete cascade;

update public.cafe_tables
set business_id = 'a0000000-0000-4000-8000-000000000001'
where business_id is null;

update public.cafe_orders
set business_id = 'a0000000-0000-4000-8000-000000000001'
where business_id is null;

update public.cafe_menu_categories
set business_id = 'a0000000-0000-4000-8000-000000000001'
where business_id is null;

alter table public.cafe_tables alter column business_id set not null;
alter table public.cafe_orders alter column business_id set not null;
alter table public.cafe_menu_categories alter column business_id set not null;

-- Varsayılan masalar (tablo boşsa)
insert into public.cafe_tables (business_id, id, name)
select 'a0000000-0000-4000-8000-000000000001', n, 'Masa ' || n
from generate_series(1, 10) as n
where not exists (
  select 1 from public.cafe_tables t
  where t.business_id = 'a0000000-0000-4000-8000-000000000001'
);

-- Aynı masa numarası farklı işletmelerde olabilsin diye birincil anahtar (business_id, id)
alter table public.cafe_tables drop constraint if exists cafe_tables_pkey;
alter table public.cafe_tables add primary key (business_id, id);

create index if not exists cafe_orders_business_created_idx
  on public.cafe_orders (business_id, created_at desc);

create index if not exists cafe_menu_categories_business_sort_idx
  on public.cafe_menu_categories (business_id, sort_order);

-- Ürün satırında tenant (Realtime / sorgu)
alter table public.cafe_menu_items
  add column if not exists business_id uuid references public.businesses (id) on delete cascade;

update public.cafe_menu_items mi
set business_id = mc.business_id
from public.cafe_menu_categories mc
where mi.category_id = mc.id
  and mi.business_id is null;

alter table public.cafe_menu_items alter column business_id set not null;

create index if not exists cafe_menu_items_business_idx
  on public.cafe_menu_items (business_id, category_id, sort_order);

-- ── Google OAuth: auth.users ↔ business_users ──
-- Dashboard → Authentication → Google + Redirect URL: .../auth/callback
alter table public.business_users
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

create unique index if not exists business_users_auth_user_id_uq
  on public.business_users (auth_user_id)
  where auth_user_id is not null;

create index if not exists business_users_auth_user_lookup_idx
  on public.business_users (auth_user_id)
  where auth_user_id is not null;

create or replace function public.get_business_id_for_auth_user()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id
  from public.business_users
  where auth_user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.get_business_id_for_auth_user() to authenticated;

create or replace function public.register_business_with_google(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_slug text := lower(trim(p_slug));
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  if exists (select 1 from public.business_users where auth_user_id = uid) then
    raise exception 'Bu Google hesabı zaten bir işletmeye bağlı';
  end if;
  if length(trim(p_name)) < 1 or length(v_slug) < 2 then
    raise exception 'Geçersiz işletme veya kısa adres';
  end if;

  insert into public.businesses (name, slug)
  values (trim(p_name), v_slug)
  returning id into v_id;

  insert into public.business_users (business_id, username, password_hash, auth_user_id)
  values (v_id, 'google', crypt(gen_random_uuid()::text, gen_salt('bf')), uid);

  return v_id;
exception
  when unique_violation then
    raise exception 'Bu kısa adres zaten kullanılıyor';
end;
$$;

grant execute on function public.register_business_with_google(text, text) to authenticated;

