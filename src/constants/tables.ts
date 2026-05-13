/** En az bırakılacak masa sayısı (silme buna düşürülemez). */
export const MIN_TABLE_COUNT = 1

/** Varsayılan masa sayısı (ilk kurulum). */
export const TABLE_COUNT = 10

/** cafe_orders / cafe_tables ile uyumlu üst sınır. */
export const MAX_TABLE_ID = 50

export type CafeTable = {
  id: number
  /** Supabase / kimlik: her zaman `Masa {id}` (QR ile uyumlu). */
  name: string
  /** Opsiyonel: panelde gösterilecek takma ad. */
  nickname: string | null
}

/** QR ve veritabanında kullanılan sabit etiket. */
export function canonicalTableName(id: number): string {
  return `Masa ${id}`
}

/** Kart ve menüde gösterilecek metin. */
export function tableDisplayLabel(table: Pick<CafeTable, 'id' | 'name' | 'nickname'>): string {
  const nick = table.nickname?.trim()
  if (nick) return nick
  return canonicalTableName(table.id)
}

/** Varsayılan masa listesi (Masa 1 … Masa 10). */
export const CAFE_TABLES: CafeTable[] = Array.from({ length: TABLE_COUNT }, (_, i) => {
  const n = i + 1
  return { id: n, name: canonicalTableName(n), nickname: null }
})
