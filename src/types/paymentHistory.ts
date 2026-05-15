import type { OrderLine } from '@/types/order'

export type CafePaymentHistoryRecord = {
  id: string
  businessId: string
  tableNumber: number
  tableDisplayName: string | null
  totalTry: number
  orderCount: number
  lines: OrderLine[]
  paidAt: string
}

export type CafePaymentHistoryRow = {
  id: string
  business_id: string
  table_number: number
  table_display_name: string | null
  total_try: number
  order_count: number
  lines: OrderLine[]
  paid_at: string
}
