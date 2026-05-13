/** Varsayılan masa sayısı (ilk kurulum). */
export const TABLE_COUNT = 10

/** cafe_orders / cafe_tables ile uyumlu üst sınır. */
export const MAX_TABLE_ID = 50

export type CafeTable = {
  id: number
  name: string
}

/** Varsayılan masa listesi (Masa 1 … Masa 10). */
export const CAFE_TABLES: CafeTable[] = Array.from({ length: TABLE_COUNT }, (_, i) => {
  const n = i + 1
  return { id: n, name: `Masa ${n}` }
})
