import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CafeTable } from '@/constants/tables'
import type { CafeOrder } from '@/types/order'
import { recordOrderAttentionCleared } from '@/services/tableRepository'
import { startOrderAlarm, stopOrderAlarm } from '@/utils/orderAlarmSound'

function attentionTablesFromServer(orders: CafeOrder[], tables: CafeTable[]): Set<number> {
  const clearedAt = new Map<number, string | null>(
    tables.map((t) => [t.id, t.lastOrderAttentionClearedAt] as const),
  )
  const next = new Set<number>()
  for (const o of orders) {
    const cleared = clearedAt.get(o.tableNumber) ?? null
    const boundaryMs = cleared ? new Date(cleared).getTime() : 0
    const createdMs = new Date(o.createdAt).getTime()
    if (Number.isFinite(createdMs) && Number.isFinite(boundaryMs) && createdMs > boundaryMs) {
      next.add(o.tableNumber)
    }
  }
  return next
}

type UseNewOrderAttentionArgs = {
  businessId: string | null
  orders: CafeOrder[]
  ordersLoading: boolean
  tables: CafeTable[]
  tablesLoading: boolean
  refreshTables: () => void | Promise<void>
}

export function useNewOrderAttention({
  businessId,
  orders,
  ordersLoading,
  tables,
  tablesLoading,
  refreshTables,
}: UseNewOrderAttentionArgs) {
  const [incomingOpen, setIncomingOpen] = useState(false)
  const [alertTables, setAlertTables] = useState<number[]>([])

  const prevIdsRef = useRef<Set<string>>(new Set())
  const bootRef = useRef(true)

  const dataLoading = ordersLoading || tablesLoading

  const attentionTables = useMemo(() => {
    if (ordersLoading || tablesLoading) return new Set<number>()
    return attentionTablesFromServer(orders, tables)
  }, [orders, tables, ordersLoading, tablesLoading])

  useEffect(() => {
    if (dataLoading) return

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
  }, [orders, dataLoading])

  const dismissIncoming = useCallback(() => {
    stopOrderAlarm()
    setIncomingOpen(false)
  }, [])

  const clearAttention = useCallback(
    async (tableId: number) => {
      if (!businessId) return
      try {
        await recordOrderAttentionCleared(businessId, tableId)
        await refreshTables()
      } catch {
        /* ağ hatası: personel tekrar dener */
      }
    },
    [businessId, refreshTables],
  )

  useEffect(() => () => stopOrderAlarm(), [])

  return {
    attentionTables,
    incomingOpen,
    alertTables,
    dismissIncoming,
    clearAttention,
  }
}
