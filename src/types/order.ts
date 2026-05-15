export type OrderLine = {
  /** Sepette bir satırı tanımlamak için */
  key: string
  name: string
  price: number
  qty: number
}

export type CafeOrder = {
  id: string
  tableNumber: number
  lines: OrderLine[]
  totalTry: number
  createdAt: string
}

/** Supabase satırı (PostgREST yanıtı) */
export type CafeOrderRow = {
  id: string
  business_id: string
  table_number: number
  lines: OrderLine[]
  total_try: number
  created_at: string
}
