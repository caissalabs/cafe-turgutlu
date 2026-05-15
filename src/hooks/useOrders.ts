import { useCallback, useEffect, useState } from 'react'
import type { CafeOrder } from '@/types/order'
import { fetchAllOrders, subscribeOrders } from '@/services/orderRepository'

export function useOrders(businessId: string | null) {
  const [orders, setOrders] = useState<CafeOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshOrders = useCallback(async () => {
    if (!businessId) {
      setOrders([])
      setError(null)
      return
    }
    try {
      const list = await fetchAllOrders(businessId)
      setOrders(list)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Siparişler yüklenemedi')
    }
  }, [businessId])

  useEffect(() => {
    if (!businessId) {
      setOrders([])
      setLoading(false)
      setError(null)
      return
    }

    let alive = true
    setLoading(true)
    void (async () => {
      try {
        const list = await fetchAllOrders(businessId)
        if (alive) {
          setOrders(list)
          setError(null)
        }
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : 'Siparişler yüklenemedi')
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()

    const unsub = subscribeOrders(businessId, (list) => {
      if (alive) {
        setOrders(list)
        setError(null)
      }
    })

    return () => {
      alive = false
      unsub()
    }
  }, [businessId])

  return { orders, loading, error, refreshOrders }
}
