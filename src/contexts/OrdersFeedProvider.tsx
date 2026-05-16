import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { ORDERS_PANEL_POLL_INTERVAL_MS } from '@/constants/orders'
import { OrdersFeedContext } from '@/contexts/orders-feed-context'
import type { CafeOrder } from '@/types/order'
import { fetchAllOrders, subscribeOrders } from '@/services/orderRepository'

export function OrdersFeedProvider({
  businessId,
  children,
}: {
  businessId: string | null
  children: ReactNode
}) {
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

    const pollId = window.setInterval(() => {
      void refreshOrders()
    }, ORDERS_PANEL_POLL_INTERVAL_MS)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refreshOrders()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      alive = false
      unsub()
      window.clearInterval(pollId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [businessId, refreshOrders])

  const value = useMemo(
    () => ({
      orders,
      loading,
      error,
      refreshOrders,
    }),
    [orders, loading, error, refreshOrders],
  )

  return (
    <OrdersFeedContext.Provider value={value}>{children}</OrdersFeedContext.Provider>
  )
}
