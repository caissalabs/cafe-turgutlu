import { supabase } from '@/lib/supabaseClient'
import type {
  CafeMenuCategory,
  CafeMenuCategoryRow,
  CafeMenuItem,
  CafeMenuItemRow,
} from '@/types/menu'

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg'])
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

function parseAllergens(raw: string[] | null | undefined): string[] {
  if (!raw || !Array.isArray(raw)) return []
  return [...new Set(raw.map((s) => String(s).trim()).filter(Boolean))]
}

function mapItemRow(row: CafeMenuItemRow): CafeMenuItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description ?? '',
    price: Number(row.price),
    allergens: parseAllergens(row.allergens),
    imageUrl: row.image_url?.trim() || null,
    sortOrder: Number(row.sort_order),
  }
}

function sortCategories(list: CafeMenuCategory[]): CafeMenuCategory[] {
  return [...list]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'tr'))
    .map((c) => ({
      ...c,
      items: [...c.items].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'tr'),
      ),
    }))
}

async function loadMenuFromDb(businessId: string): Promise<CafeMenuCategory[]> {
  const [catRes, itemRes] = await Promise.all([
    supabase
      .from('cafe_menu_categories')
      .select('id, title, sort_order, business_id')
      .eq('business_id', businessId)
      .order('sort_order'),
    supabase
      .from('cafe_menu_items')
      .select('*')
      .eq('business_id', businessId)
      .order('sort_order'),
  ])
  if (catRes.error) throw catRes.error
  if (itemRes.error) throw itemRes.error

  const catRows = (catRes.data ?? []) as CafeMenuCategoryRow[]
  const itemRows = (itemRes.data ?? []) as CafeMenuItemRow[]
  const itemsByCat = new Map<string, CafeMenuItem[]>()
  for (const r of itemRows) {
    const arr = itemsByCat.get(r.category_id) ?? []
    arr.push(mapItemRow(r))
    itemsByCat.set(r.category_id, arr)
  }

  const list: CafeMenuCategory[] = catRows.map((c) => ({
    id: c.id,
    title: c.title,
    sortOrder: c.sort_order,
    items: itemsByCat.get(c.id) ?? [],
  }))
  return sortCategories(list)
}

export async function fetchMenu(businessId: string): Promise<CafeMenuCategory[]> {
  return loadMenuFromDb(businessId)
}

export async function createMenuCategory(
  businessId: string,
  title: string,
): Promise<CafeMenuCategory> {
  const trimmed = title.trim()
  if (!trimmed) throw new Error('Kategori adı gerekli.')

  const { data: existing } = await supabase
    .from('cafe_menu_categories')
    .select('sort_order')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextOrder =
    existing && existing.length > 0 ? Number((existing[0] as { sort_order: number }).sort_order) + 1 : 0
  const { data, error } = await supabase
    .from('cafe_menu_categories')
    .insert({ business_id: businessId, title: trimmed, sort_order: nextOrder })
    .select('id, title, sort_order')
    .single()
  if (error) throw error
  const row = data as CafeMenuCategoryRow
  return { id: row.id, title: row.title, sortOrder: row.sort_order, items: [] }
}

export async function updateMenuCategory(
  businessId: string,
  id: string,
  patch: { title?: string },
): Promise<void> {
  const title = patch.title?.trim()
  if (title !== undefined && !title) throw new Error('Kategori adı boş olamaz.')

  const { error } = await supabase
    .from('cafe_menu_categories')
    .update(title !== undefined ? { title } : {})
    .eq('id', id)
    .eq('business_id', businessId)
  if (error) throw error
}

export async function deleteMenuCategory(businessId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('cafe_menu_categories')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)
  if (error) throw error
}

export async function reorderMenuCategories(
  businessId: string,
  orderedIds: string[],
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('cafe_menu_categories')
      .update({ sort_order: i })
      .eq('id', orderedIds[i]!)
      .eq('business_id', businessId)
    if (error) throw error
  }
}

export type MenuItemInput = {
  name: string
  description: string
  price: number
  allergens: string[]
  imageUrl: string | null
}

export async function createMenuItem(
  businessId: string,
  categoryId: string,
  input: MenuItemInput,
): Promise<CafeMenuItem> {
  const name = input.name.trim()
  if (!name) throw new Error('Ürün adı gerekli.')
  if (!Number.isFinite(input.price) || input.price < 0) throw new Error('Geçerli bir fiyat girin.')
  const allergens = parseAllergens(input.allergens)
  const description = input.description.trim()

  const { data: siblings } = await supabase
    .from('cafe_menu_items')
    .select('sort_order')
    .eq('business_id', businessId)
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextOrder =
    siblings && siblings.length > 0
      ? Number((siblings[0] as { sort_order: number }).sort_order) + 1
      : 0
  const { data, error } = await supabase
    .from('cafe_menu_items')
    .insert({
      business_id: businessId,
      category_id: categoryId,
      name,
      description,
      price: input.price,
      allergens,
      image_url: input.imageUrl?.trim() || null,
      sort_order: nextOrder,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapItemRow(data as CafeMenuItemRow)
}

export async function updateMenuItem(
  businessId: string,
  id: string,
  input: Partial<MenuItemInput>,
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) {
    const n = input.name.trim()
    if (!n) throw new Error('Ürün adı boş olamaz.')
    patch.name = n
  }
  if (input.description !== undefined) patch.description = input.description.trim()
  if (input.price !== undefined) {
    if (!Number.isFinite(input.price) || input.price < 0) throw new Error('Geçerli bir fiyat girin.')
    patch.price = input.price
  }
  if (input.allergens !== undefined) patch.allergens = parseAllergens(input.allergens)
  if (input.imageUrl !== undefined) patch.image_url = input.imageUrl?.trim() || null
  const { error } = await supabase
    .from('cafe_menu_items')
    .update(patch)
    .eq('id', id)
    .eq('business_id', businessId)
  if (error) throw error
}

export async function deleteMenuItem(businessId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('cafe_menu_items')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)
  if (error) throw error
}

export async function reorderMenuItems(
  businessId: string,
  categoryId: string,
  orderedItemIds: string[],
): Promise<void> {
  for (let i = 0; i < orderedItemIds.length; i++) {
    const { error } = await supabase
      .from('cafe_menu_items')
      .update({ sort_order: i })
      .eq('id', orderedItemIds[i]!)
      .eq('category_id', categoryId)
      .eq('business_id', businessId)
    if (error) throw error
  }
}

export async function uploadMenuItemImage(businessId: string, file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Yalnızca PNG veya JPEG yükleyebilirsiniz.')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Görsel en fazla 3 MB olabilir.')
  }

  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${businessId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('menu-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (error) {
    const msg = error.message ?? ''
    if (
      msg.toLowerCase().includes('row-level security') ||
      msg.toLowerCase().includes('rls') ||
      (error as { code?: string }).code === '42501'
    ) {
      throw new Error(
        'Görsel yüklenemedi: Supabase Storage izni yok. SQL Editor’de supabase-storage-menu-images-policies.sql dosyasını çalıştırın veya menu-images bucket için anon/authenticated INSERT politikası ekleyin.',
      )
    }
    throw error
  }
  const { data } = supabase.storage.from('menu-images').getPublicUrl(path)
  return data.publicUrl
}

export function subscribeMenu(businessId: string, onChange: () => void): () => void {
  let cancelled = false
  const trigger = () => {
    if (!cancelled) onChange()
  }

  let t: number | undefined
  const debounced = () => {
    window.clearTimeout(t)
    t = window.setTimeout(trigger, 120)
  }

  const filter = `business_id=eq.${businessId}`
  const channel = supabase
    .channel(`cafe_menu_${businessId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cafe_menu_categories', filter },
      debounced,
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_menu_items', filter }, debounced)
    .subscribe()

  return () => {
    cancelled = true
    window.clearTimeout(t)
    void supabase.removeChannel(channel)
  }
}
