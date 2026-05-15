# Özel menü — Kurulum adımları (Supabase)

Aşağıdaki sırayı uygulayın.

---

## Adım 1 — Veritabanı tabloları ve menü RLS (zorunlu)

1. Supabase projesinde **SQL Editor**’ü açın.
2. `supabase-custom-menu-part1-public.sql` dosyasının **tamamını** yeni bir sorguya yapıştırın.
3. **Run** ile çalıştırın.

**Not:** `alter publication supabase_realtime add table ...` satırları, tablolar zaten yayına ekliyse hata verebilir. Hata alırsanız o iki satırı silin veya başına `--` koyup tekrar çalıştırın. Gerekirse **Database → Publications → supabase_realtime** içinden `cafe_menu_categories` ve `cafe_menu_items` manuel ekleyin.

---

## Adım 2 — Storage bucket `menu-images` (görseller için)

Görselleri uygulamada kullanacaksanız bucket şart.

### Seçenek A — SQL ile (deneme)

1. Yeni bir SQL sorgusu açın.
2. Yalnızca `supabase-custom-menu-part2-storage.sql` içindeki **`insert into storage.buckets`** bloğunu çalıştırın.
3. Hata alırsanız **Seçenek B**’ye geçin.

### Seçenek B — Dashboard (önerilen)

1. **Storage** → **New bucket**
2. **Name:** `menu-images`
3. **Public bucket:** açık (public)
4. İsterseniz **File size limit:** 3 MB; **Allowed MIME types:** `image/png`, `image/jpeg` (arayüzde varsa doldurun)

---

## Adım 3 — Storage erişim politikaları (zorunlu — genelde SQL ile değil, arayüzden)

`storage.objects` üzerinde policy eklerken SQL Editor bazen **“must be owner of table objects”** verir. Bu yüzden politikaları **Storage** ekranından ekleyin.

1. **Storage** → **Policies** (veya `menu-images` bucket → **Policies**)
2. **menu-images** için aşağıdaki mantıkta policy’ler oluşturun (isimler sizde farklı olabilir):

| İşlem        | Kim        | Özet koşul                          |
|-------------|------------|-------------------------------------|
| Okuma (SELECT) | `public` veya herkes | `bucket_id = 'menu-images'`     |
| Yükleme (INSERT) | `anon`    | `bucket_id = 'menu-images'`     |
| Güncelleme (UPDATE) | `anon` | `bucket_id = 'menu-images'`     |
| Silme (DELETE) | `anon`  | `bucket_id = 'menu-images'`     |

Supabase arayüzünde **“New policy”** → şablon olarak “Allow public read access” / “Allow uploads” benzeri seçenekleri kullanıp bucket’ı `menu-images` ile sınırlayın.

> Bu proje client’ta **anon** anahtar kullanıyor; yükleme/silme için `anon` policy gerekir. Üretimde isterseniz bunu daraltıp Edge Function veya `authenticated` kullanımına geçebilirsiniz.

---

## Adım 4 — Uygulamayı kontrol edin

1. `.env` / `.env.local` içinde `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` doğru olsun.
2. Yönetim panelinde **Menü** ile kategori/ürün ekleyin, PNG veya JPEG yüklemeyi deneyin.
3. Hata olursa tarayıcı konsolu ve Supabase **Logs** (API / Storage) kayıtlarına bakın.

---

## Dosya özeti

| Dosya | Ne zaman |
|--------|----------|
| `supabase-custom-menu-part1-public.sql` | İlk sırada: tablolar + menü RLS + realtime |
| `supabase-custom-menu-part2-storage.sql` | İsteğe bağlı: bucket `insert` denemesi |
| `supabase-custom-menu-KURULUM-ADIMLAR.md` | Bu rehber |

Eski tek dosya: `supabase-custom-menu.sql` artık yalnızca yönlendirme içerir; doğrudan parçaları kullanın.
