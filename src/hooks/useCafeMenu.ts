import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CafeMenuCategory } from '@/types/menu'
import { fetchMenu, subscribeMenu } from '@/services/menuRepository'

export function useCafeMenu(businessId: string | null) {
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
    if (!businessId) return () => {}
    return subscribeMenu(businessId, () => void load())
  }, [businessId, load])

  const isConfigured = useMemo(
    () => categories.some((c) => c.items.length > 0),
    [categories],
  )

  return { categories, loading, error, isConfigured, refreshMenu: load }
}
