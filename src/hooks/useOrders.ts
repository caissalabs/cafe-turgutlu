import { useEffect, useState } from 'react'
import type { CafeOrder } from '@/types/order'
import { fetchAllOrders, subscribeOrders } from '@/services/orderRepository'

export function useOrders() {
  const [orders, setOrders] = useState<CafeOrder[]>(() => fetchAllOrders())

  useEffect(() => {
    let alive = true
    const unsub = subscribeOrders((list) => {
      if (alive) setOrders(list)
    })
    return () => {
      alive = false
      unsub()
    }
  }, [])

  return { orders, loading: false, error: null as string | null }
}
