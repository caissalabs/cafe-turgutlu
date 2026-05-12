import { useCallback, useEffect, useRef, useState } from 'react'
import type { CafeOrder } from '@/types/order'
import { startOrderAlarm, stopOrderAlarm } from '@/utils/orderAlarmSound'

export function useNewOrderAttention(orders: CafeOrder[]) {
  const [attentionTables, setAttentionTables] = useState(() => new Set<number>())
  const [incomingOpen, setIncomingOpen] = useState(false)
  const [alertTables, setAlertTables] = useState<number[]>([])

  const prevIdsRef = useRef<Set<string>>(new Set())
  const bootRef = useRef(true)

  useEffect(() => {
    const ids = new Set(orders.map((o) => o.id))

    if (bootRef.current) {
      bootRef.current = false
      prevIdsRef.current = ids
      return
    }

    const prevIds = prevIdsRef.current
    const newlyAdded = orders.filter((o) => !prevIds.has(o.id))
    prevIdsRef.current = ids

    const tablesFromNew =
      newlyAdded.length > 0
        ? [...new Set(newlyAdded.map((o) => o.tableNumber))].sort((a, b) => a - b)
        : null

    if (tablesFromNew) {
      setAlertTables(tablesFromNew)
      setIncomingOpen(true)
      startOrderAlarm()
    }

    setAttentionTables((prevAttention) => {
      const next = new Set(prevAttention)
      for (const tid of prevAttention) {
        if (!orders.some((o) => o.tableNumber === tid)) next.delete(tid)
      }
      if (tablesFromNew) tablesFromNew.forEach((t) => next.add(t))
      return next
    })
  }, [orders])

  const dismissIncoming = useCallback(() => {
    stopOrderAlarm()
    setIncomingOpen(false)
  }, [])

  const clearAttention = useCallback((tableId: number) => {
    setAttentionTables((prev) => {
      const next = new Set(prev)
      next.delete(tableId)
      return next
    })
  }, [])

  useEffect(() => () => stopOrderAlarm(), [])

  return {
    attentionTables,
    incomingOpen,
    alertTables,
    dismissIncoming,
    clearAttention,
  }
}
