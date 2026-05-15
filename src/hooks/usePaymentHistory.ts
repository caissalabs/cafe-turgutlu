import { useCallback, useEffect, useState } from 'react'
import type { CafePaymentHistoryRecord } from '@/types/paymentHistory'
import { fetchPaymentHistory, subscribePaymentHistory } from '@/services/paymentHistoryRepository'

export function usePaymentHistory(businessId: string | null) {
  const [rows, setRows] = useState<CafePaymentHistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!businessId) {
      setRows([])
      setError(null)
      return
    }
    try {
      const list = await fetchPaymentHistory(businessId)
      setRows(list)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ödeme geçmişi yüklenemedi')
    }
  }, [businessId])

  useEffect(() => {
    if (!businessId) {
      setRows([])
      setLoading(false)
      setError(null)
      return
    }

    let alive = true
    setLoading(true)
    void (async () => {
      try {
        const list = await fetchPaymentHistory(businessId)
        if (alive) {
          setRows(list)
          setError(null)
        }
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : 'Ödeme geçmişi yüklenemedi')
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()

    const unsub = subscribePaymentHistory(businessId, (list) => {
      if (alive) {
        setRows(list)
        setError(null)
      }
    })

    return () => {
      alive = false
      unsub()
    }
  }, [businessId])

  return { rows, loading, error, refresh }
}
