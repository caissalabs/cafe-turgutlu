import { useCallback, useEffect, useState } from 'react'
import type { CafeOrder } from '@/types/order'
import {
  fetchAllOrders,
  getOrderStorageKind,
  subscribeOrders,
} from '@/services/orderRepository'

export function useOrders() {
  const [orders, setOrders] = useState<CafeOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const storageKind = getOrderStorageKind()

  const refreshOrders = useCallback(async () => {
    try {
      const list = await fetchAllOrders()
      setOrders(list)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Siparişler yüklenemedi')
    }
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const list = await fetchAllOrders()
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

    const unsub = subscribeOrders((list) => {
      if (alive) {
        setOrders(list)
        setError(null)
      }
    })

    return () => {
      alive = false
      unsub()
    }
  }, [])

  return { orders, loading, error, storageKind, refreshOrders }
}
