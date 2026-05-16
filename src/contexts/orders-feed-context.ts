import { createContext } from 'react'
import type { CafeOrder } from '@/types/order'

export type OrdersFeedContextValue = {
  orders: CafeOrder[]
  loading: boolean
  error: string | null
  refreshOrders: () => Promise<void>
}

export const OrdersFeedContext = createContext<OrdersFeedContextValue | null>(null)
