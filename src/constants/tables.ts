export const TABLE_COUNT = 10

export type CafeTable = {
  id: number
  name: string
}

/** Sabit masa listesi (masa1 … masa10). */
export const CAFE_TABLES: CafeTable[] = Array.from({ length: TABLE_COUNT }, (_, i) => {
  const n = i + 1
  return { id: n, name: `masa${n}` }
})
