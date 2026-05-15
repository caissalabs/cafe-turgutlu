import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useCafeMenu } from '@/hooks/useCafeMenu'
import type { CafeMenuCategory, CafeMenuItem } from '@/types/menu'
import {
  createMenuCategory,
  createMenuItem,
  deleteMenuCategory,
  deleteMenuItem,
  reorderMenuCategories,
  reorderMenuItems,
  updateMenuCategory,
  updateMenuItem,
  uploadMenuItemImage,
  type MenuItemInput,
} from '@/services/menuRepository'
import styles from './MenuEditorPage.module.css'

function parseAllergenField(s: string): string[] {
  return [
    ...new Set(
      s
        .split(/[,;\n]/)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ]
}

type ItemEditorState = {
  name: string
  description: string
  price: string
  allergens: string
  imageUrl: string | null
  imageFile: File | null
}

function emptyItemState(): ItemEditorState {
  return {
    name: '',
    description: '',
    price: '',
    allergens: '',
    imageUrl: null,
    imageFile: null,
  }
}

export function MenuEditorPage() {
  useDocumentTitle('Cafe Turgutlu — Menü yönetimi')
  const { businessId } = useAuth()
  const { categories, loading, error, refreshMenu } = useCafeMenu(businessId)
  const [actionErr, setActionErr] = useState<string | null>(null)
  const [newCategoryTitle, setNewCategoryTitle] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [expandedAddItem, setExpandedAddItem] = useState<string | null>(null)
  const [newItemByCat, setNewItemByCat] = useState<Record<string, ItemEditorState>>({})

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setActionErr(null)
      try {
        await fn()
        await refreshMenu()
      } catch (e) {
        setActionErr(e instanceof Error ? e.message : 'İşlem başarısız')
      }
    },
    [refreshMenu],
  )

  if (!businessId) {
    return (
      <section className={styles.wrap}>
        <p className={styles.err}>İşletme bilgisi bulunamadı. Lütfen tekrar giriş yapın.</p>
        <p>
          <Link to="/login">Giriş sayfasına dön</Link>
        </p>
      </section>
    )
  }

  const moveCategory = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= categories.length) return
    const ids = categories.map((c) => c.id)
    ;[ids[index], ids[j]] = [ids[j]!, ids[index]!]
    void run(() => reorderMenuCategories(businessId, ids))
  }

  const moveItem = (cat: CafeMenuCategory, itemIndex: number, dir: -1 | 1) => {
    const j = itemIndex + dir
    if (j < 0 || j >= cat.items.length) return
    const ids = cat.items.map((i) => i.id)
    ;[ids[itemIndex], ids[j]] = [ids[j]!, ids[itemIndex]!]
    void run(() => reorderMenuItems(businessId, cat.id, ids))
  }

  const getNewItemState = (catId: string): ItemEditorState =>
    newItemByCat[catId] ?? emptyItemState()

  const setNewItem = (catId: string, patch: Partial<ItemEditorState>) => {
    setNewItemByCat((prev) => ({
      ...prev,
      [catId]: { ...getNewItemState(catId), ...patch },
    }))
  }

  const handleAddItem = (categoryId: string) => {
    const st = getNewItemState(categoryId)
    const price = Number.parseFloat(st.price.replace(',', '.'))
    if (!st.name.trim()) {
      setActionErr('Ürün adı gerekli.')
      return
    }
    if (!Number.isFinite(price) || price < 0) {
      setActionErr('Geçerli bir fiyat girin.')
      return
    }
    void run(async () => {
      let imageUrl = st.imageUrl
      if (st.imageFile) {
        imageUrl = await uploadMenuItemImage(businessId, st.imageFile)
      }
      await createMenuItem(businessId, categoryId, {
        name: st.name.trim(),
        description: st.description.trim(),
        price,
        allergens: parseAllergenField(st.allergens),
        imageUrl,
      })
      setNewItem(categoryId, emptyItemState())
      setExpandedAddItem(null)
    })
  }

  return (
    <section className={styles.wrap}>
      <div>
        <h1>Menü yönetimi</h1>
        <p className={styles.lead}>
          Kategoriler ve ürünler müşteri menüsünde görünür. Görseller yalnızca PNG veya JPEG olabilir (en
          fazla 3 MB).
        </p>
      </div>

      {(error || actionErr) && (
        <p className={styles.err} role="alert">
          {error ?? actionErr}
        </p>
      )}

      <div className={styles.toolbar}>
        <input
          type="text"
          className={styles.input}
          placeholder="Yeni kategori adı"
          value={newCategoryTitle}
          onChange={(e) => setNewCategoryTitle(e.target.value)}
          aria-label="Yeni kategori adı"
          style={{ flex: '1 1 200px', maxWidth: '280px' }}
        />
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={addingCategory || !newCategoryTitle.trim()}
          onClick={() => {
            const t = newCategoryTitle.trim()
            if (!t) return
            setAddingCategory(true)
            void (async () => {
              try {
                await run(async () => {
                  await createMenuCategory(businessId, t)
                  setNewCategoryTitle('')
                })
              } finally {
                setAddingCategory(false)
              }
            })()
          }}
        >
          Kategori ekle
        </button>
        <Link to="/home/menu/onizleme" className={styles.secondaryBtn}>
          Menüyü önizle
        </Link>
      </div>

      {loading ? <p className={styles.empty}>Menü yükleniyor…</p> : null}

      {!loading && categories.length === 0 ? (
        <p className={styles.empty}>Henüz kategori yok. Yukarıdan ilk kategorinizi ekleyin.</p>
      ) : null}

      {!loading &&
        categories.map((cat, ci) => (
          <div key={cat.id} className={styles.category}>
            <div className={styles.categoryHead}>
              <CategoryTitleField
                categoryId={cat.id}
                title={cat.title}
                onCommit={(title) => void run(() => updateMenuCategory(businessId, cat.id, { title }))}
              />
              <div className={styles.reorderGroup}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  disabled={ci === 0}
                  onClick={() => moveCategory(ci, -1)}
                  aria-label="Kategoriyi yukarı taşı"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  disabled={ci === categories.length - 1}
                  onClick={() => moveCategory(ci, 1)}
                  aria-label="Kategoriyi aşağı taşı"
                >
                  ↓
                </button>
              </div>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={() => {
                  if (window.confirm(`“${cat.title}” kategorisini ve tüm ürünlerini silmek istiyor musunuz?`)) {
                    void run(() => deleteMenuCategory(businessId, cat.id))
                  }
                }}
              >
                Kategoriyi sil
              </button>
            </div>
            <div className={styles.categoryBody}>
              {cat.items.length === 0 ? (
                <p className={styles.empty}>Bu kategoride ürün yok.</p>
              ) : null}
              {cat.items.map((item, ii) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  isFirst={ii === 0}
                  isLast={ii === cat.items.length - 1}
                  onMoveUp={() => moveItem(cat, ii, -1)}
                  onMoveDown={() => moveItem(cat, ii, 1)}
                  onDelete={() => {
                    if (window.confirm(`“${item.name}” ürününü silmek istiyor musunuz?`)) {
                      void run(() => deleteMenuItem(businessId, item.id))
                    }
                  }}
                  onPatch={(patch) => void run(() => updateMenuItem(businessId, item.id, patch))}
                  onUpload={async (file) => {
                    const url = await uploadMenuItemImage(businessId, file)
                    await run(() => updateMenuItem(businessId, item.id, { imageUrl: url }))
                  }}
                />
              ))}

              {expandedAddItem === cat.id ? (
                <div className={styles.itemCard}>
                  <h3 className={styles.label} style={{ margin: 0, fontSize: '0.85rem' }}>
                    Yeni ürün
                  </h3>
                  <NewItemForm
                    state={getNewItemState(cat.id)}
                    onChange={(p) => setNewItem(cat.id, p)}
                    onSubmit={() => handleAddItem(cat.id)}
                    onCancel={() => {
                      setExpandedAddItem(null)
                      setNewItem(cat.id, emptyItemState())
                    }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => setExpandedAddItem(cat.id)}
                >
                  + Ürün ekle
                </button>
              )}
            </div>
          </div>
        ))}
    </section>
  )
}

function CategoryTitleField({
  categoryId,
  title,
  onCommit,
}: {
  categoryId: string
  title: string
  onCommit: (title: string) => void
}) {
  const [value, setValue] = useState(title)
  useEffect(() => {
    setValue(title)
  }, [categoryId, title])
  return (
    <input
      type="text"
      className={styles.categoryTitleInput}
      value={value}
      aria-label={`Kategori adı: ${title}`}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const t = value.trim()
        if (t && t !== title) onCommit(t)
      }}
    />
  )
}

function NewItemForm({
  state,
  onChange,
  onSubmit,
  onCancel,
}: {
  state: ItemEditorState
  onChange: (p: Partial<ItemEditorState>) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <>
      <div className={styles.fields}>
        <label className={styles.label} htmlFor="ni-name">
          Ürün adı
        </label>
        <input
          id="ni-name"
          className={styles.input}
          value={state.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <label className={styles.label} htmlFor="ni-desc">
          İçerik / açıklama
        </label>
        <textarea
          id="ni-desc"
          className={styles.textarea}
          value={state.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
        <label className={styles.label} htmlFor="ni-price">
          Fiyat (₺)
        </label>
        <input
          id="ni-price"
          type="text"
          inputMode="decimal"
          className={`${styles.input} ${styles.priceRow}`}
          value={state.price}
          onChange={(e) => onChange({ price: e.target.value })}
        />
        <label className={styles.label} htmlFor="ni-all">
          Alerjenler (virgülle)
        </label>
        <textarea
          id="ni-all"
          className={styles.textarea}
          rows={2}
          placeholder="Örn: Gluten, Süt, Fıstık"
          value={state.allergens}
          onChange={(e) => onChange({ allergens: e.target.value })}
        />
        <label className={styles.label} htmlFor="ni-img">
          Görsel (PNG / JPEG)
        </label>
        <input
          id="ni-img"
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => {
            const f = e.target.files?.[0]
            onChange({ imageFile: f ?? null, imageUrl: null })
          }}
        />
        <p className={styles.fileHint}>İsteğe bağlı. Yalnızca PNG ve JPEG.</p>
      </div>
      <div className={styles.itemActions}>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={
            !state.name.trim() || !Number.isFinite(Number.parseFloat(state.price.replace(',', '.')))
          }
          onClick={() => onSubmit()}
        >
          Kaydet
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={onCancel}>
          Vazgeç
        </button>
      </div>
    </>
  )
}

function ItemRow({
  item,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
  onPatch,
  onUpload,
}: {
  item: CafeMenuItem
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onPatch: (patch: Partial<MenuItemInput>) => void
  onUpload: (file: File) => Promise<void>
}) {
  const [local, setLocal] = useState({
    name: item.name,
    description: item.description,
    price: String(item.price),
    allergens: item.allergens.join(', '),
  })

  useEffect(() => {
    setLocal({
      name: item.name,
      description: item.description,
      price: String(item.price),
      allergens: item.allergens.join(', '),
    })
  }, [item.id, item.name, item.description, item.price, item.imageUrl, item.allergens.join('|')])

  const saveField = () => {
    if (!local.name.trim()) return
    const price = Number.parseFloat(local.price.replace(',', '.'))
    if (!Number.isFinite(price) || price < 0) return
    onPatch({
      name: local.name.trim(),
      description: local.description.trim(),
      price,
      allergens: parseAllergenField(local.allergens),
    })
  }

  return (
    <div className={styles.itemCard}>
      <div className={styles.itemRow}>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className={styles.thumb} width={72} height={72} />
        ) : (
          <div className={styles.thumb} aria-hidden />
        )}
        <div className={styles.fields}>
          <label className={styles.label}>Ürün adı</label>
          <input
            className={styles.input}
            value={local.name}
            onChange={(e) => setLocal((s) => ({ ...s, name: e.target.value }))}
            onBlur={saveField}
          />
          <label className={styles.label}>İçerik / açıklama</label>
          <textarea
            className={styles.textarea}
            value={local.description}
            onChange={(e) => setLocal((s) => ({ ...s, description: e.target.value }))}
            onBlur={saveField}
          />
          <label className={styles.label}>Fiyat (₺)</label>
          <input
            className={`${styles.input} ${styles.priceRow}`}
            inputMode="decimal"
            value={local.price}
            onChange={(e) => setLocal((s) => ({ ...s, price: e.target.value }))}
            onBlur={saveField}
          />
          <label className={styles.label}>Alerjenler (virgülle)</label>
          <textarea
            className={styles.textarea}
            rows={2}
            value={local.allergens}
            onChange={(e) => setLocal((s) => ({ ...s, allergens: e.target.value }))}
            onBlur={saveField}
          />
          <label className={styles.label}>Görsel (PNG / JPEG)</label>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onUpload(f)
            }}
          />
        </div>
      </div>
      <div className={styles.itemActions}>
        <button
          type="button"
          className={styles.iconBtn}
          disabled={isFirst}
          onClick={onMoveUp}
          aria-label="Yukarı"
        >
          ↑
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          disabled={isLast}
          onClick={onMoveDown}
          aria-label="Aşağı"
        >
          ↓
        </button>
        <button type="button" className={styles.dangerBtn} onClick={onDelete}>
          Sil
        </button>
      </div>
    </div>
  )
}
