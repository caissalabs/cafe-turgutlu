import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function usePublicBusinessId() {
  const [searchParams] = useSearchParams()
  const idParam = searchParams.get('business')
  const slug = searchParams.get('isletme')

  const [businessId, setBusinessId] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (idParam) {
      const u = idParam.trim()
      if (UUID_RE.test(u)) {
        setBusinessId(u)
        setError(null)
        setResolving(false)
        return
      }
      setBusinessId(null)
      setError('Geçersiz işletme bağlantısı.')
      setResolving(false)
      return
    }

    if (slug?.trim()) {
      const s = slug.trim().toLowerCase()
      setResolving(true)
      void supabase
        .rpc('resolve_business_id_by_slug', { p_slug: s })
        .then(({ data, error: rpcErr }) => {
          if (rpcErr || !data) {
            setBusinessId(null)
            setError('İşletme bulunamadı.')
          } else {
            setBusinessId(data as string)
            setError(null)
          }
          setResolving(false)
        })
      return
    }

    setBusinessId(null)
    setError(null)
    setResolving(false)
  }, [idParam, slug])

  return { businessId, resolving, error }
}
