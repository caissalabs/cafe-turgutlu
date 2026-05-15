import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CafeMenuCategory } from '@/types/menu'
import { fetchMenu, subscribeMenu } from '@/services/menuRepository'

export type UseCafeMenuOptions = {
  /**
   * Varsayılan true. false iken Realtime kanalı açılmaz — aynı sayfada ikinci `useCafeMenu`
   * (ör. StaffTableOrderModal) aynı kanal adına tekrar abone olup istemciyi bozmasın diye.
   */
  subscribeRealtime?: boolean
}

export function useCafeMenu(businessId: string | null, options?: UseCafeMenuOptions) {
  const subscribeRealtime = options?.subscribeRealtime !== false
  const [categories, setCategories] = useState<CafeMenuCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!businessId) {
      setCategories([])
      setLoading(false)
      setError(null)
      return
    }
    try {
      const list = await fetchMenu(businessId)
      setCategories(list)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Menü yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  useEffect(() => {
    if (!businessId || !subscribeRealtime) return () => {}
    return subscribeMenu(businessId, () => void load())
  }, [businessId, load, subscribeRealtime])

  const isConfigured = useMemo(
    () => categories.some((c) => c.items.length > 0),
    [categories],
  )

  return { categories, loading, error, isConfigured, refreshMenu: load }
}
