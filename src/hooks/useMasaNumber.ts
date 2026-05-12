import { useCallback, useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { TABLE_COUNT } from '@/constants/tables'

const SESSION_KEY = 'cafe-turgutlu-masa'

function parseMasa(raw: string | null): number | null {
  if (raw == null || raw === '') return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1 || n > TABLE_COUNT) return null
  return n
}

function readSessionMasa(): number | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    return parseMasa(sessionStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

export function useMasaNumber() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const urlMasa = useMemo(
    () => parseMasa(searchParams.get('masa')),
    [searchParams],
  )

  useEffect(() => {
    if (urlMasa != null) {
      sessionStorage.setItem(SESSION_KEY, String(urlMasa))
    }
  }, [urlMasa])

  const sessionMasa = readSessionMasa()
  const masa = urlMasa ?? sessionMasa

  const setMasa = useCallback(
    (n: number) => {
      if (n < 1 || n > TABLE_COUNT) return
      sessionStorage.setItem(SESSION_KEY, String(n))
      navigate(`${location.pathname}?masa=${n}`, { replace: true })
    },
    [navigate, location.pathname],
  )

  return {
    masa,
    setMasa,
    hasMasa: masa != null,
  }
}
