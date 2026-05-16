import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useOrdersFeed } from '@/hooks/useOrdersFeed'
import { startOrderAlarm, stopOrderAlarm } from '@/utils/orderAlarmSound'

/**
 * Masalar sayfası (/home) veya sekme görünür değilken gelen yeni siparişleri izler.
 * Header'da Masalar yanında rozet; masalara dönünce modal + zil.
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

  const baselineIdsRef = useRef<Set<string>>(new Set())
  const bootRef = useRef(true)

  const [unseenBadge, setUnseenBadge] = useState(false)
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

    const baseline = baselineIdsRef.current
    const newlyAdded = orders.filter((o) => !baseline.has(o.id))
    if (newlyAdded.length > 0) {
      setUnseenBadge(true)
      setPendingTables(
        [...new Set(newlyAdded.map((o) => o.tableNumber))].sort((a, b) => a - b),
      )
    }
  }, [orders, ordersLoading, viewingMasalar])

  useEffect(() => {
    if (!viewingMasalar || !unseenBadge || pendingTables.length === 0) return
    setReturnModalOpen(true)
    startOrderAlarm()
    setUnseenBadge(false)
  }, [viewingMasalar, unseenBadge, pendingTables])

  const dismissReturnModal = useCallback(() => {
    stopOrderAlarm()
    setReturnModalOpen(false)
    setPendingTables([])
  }, [])

  useEffect(() => () => stopOrderAlarm(), [])

  return {
    masalarBadge: unseenBadge,
    returnModalOpen,
    returnModalTables: pendingTables,
    dismissReturnModal,
  }
}
