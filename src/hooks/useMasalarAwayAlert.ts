import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useOrdersFeed } from '@/hooks/useOrdersFeed'
import { startOrderAlarm, stopOrderAlarm } from '@/utils/orderAlarmSound'

/**
 * Masalar ekranı (/home) görünür değilken başka bir panel sayfasındayken gelen
 * siparişleri izler: hemen modal + zil. (/home + sekme arka planda → AdminHome’daki
 * useNewOrderAttention devreye girer; çift bildirim olmasın diye burada yok sayılır.)
 */
export function useMasalarAwayAlert() {
  const location = useLocation()
  const { orders, loading: ordersLoading } = useOrdersFeed()
  const [visibility, setVisibility] = useState(() => document.visibilityState)

  useEffect(() => {
    const fn = () => setVisibility(document.visibilityState)
    document.addEventListener('visibilitychange', fn)
    return () => document.removeEventListener('visibilitychange', fn)
  }, [])

  const viewingMasalar = useMemo(
    () => location.pathname === '/home' && visibility === 'visible',
    [location.pathname, visibility],
  )

  const masalarRouteButHidden = useMemo(
    () => location.pathname === '/home' && visibility !== 'visible',
    [location.pathname, visibility],
  )

  const baselineIdsRef = useRef<Set<string>>(new Set())
  const bootRef = useRef(true)

  const [pendingTables, setPendingTables] = useState<number[]>([])
  const [returnModalOpen, setReturnModalOpen] = useState(false)

  useEffect(() => {
    if (ordersLoading) return

    const ids = new Set(orders.map((o) => o.id))

    if (bootRef.current) {
      bootRef.current = false
      baselineIdsRef.current = ids
      return
    }

    if (viewingMasalar) {
      baselineIdsRef.current = ids
      return
    }

    if (masalarRouteButHidden) {
      return
    }

    const baseline = baselineIdsRef.current
    const newlyAdded = orders.filter((o) => !baseline.has(o.id))
    if (newlyAdded.length === 0) return

    const tables = [...new Set(newlyAdded.map((o) => o.tableNumber))].sort((a, b) => a - b)
    setPendingTables((prev) => [...new Set([...prev, ...tables])].sort((a, b) => a - b))
    setReturnModalOpen(true)
    startOrderAlarm()
    baselineIdsRef.current = ids
  }, [orders, ordersLoading, viewingMasalar, masalarRouteButHidden])

  const dismissReturnModal = useCallback(() => {
    stopOrderAlarm()
    setReturnModalOpen(false)
    setPendingTables([])
  }, [])

  useEffect(() => () => stopOrderAlarm(), [])

  return {
    returnModalOpen,
    returnModalTables: pendingTables,
    dismissReturnModal,
  }
}
