import { useEffect, useState } from 'react'
import { fetchBusinessPublicName } from '@/services/businessRepository'

/**
 * QR menüsü ve önizlemede işletme adını yükler. Yüklenene veya hataya kadar `null`;
 * arayüzde `null` ise yedek metin kullanın.
 */
export function useBusinessDisplayName(businessId: string | null | undefined): {
  displayName: string | null
  loading: boolean
} {
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!businessId) {
      setDisplayName(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    void fetchBusinessPublicName(businessId).then((name) => {
      if (!cancelled) setDisplayName(name)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [businessId])

  return { displayName, loading }
}
