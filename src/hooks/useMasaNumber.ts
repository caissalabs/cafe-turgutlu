import { useCallback, useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { TABLE_COUNT } from '@/constants/tables'

export const MASA_SESSION_KEY = 'cafe-turgutlu-masa'

export function clearMasaSession(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(MASA_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

function parseMasa(raw: string | null): number | null {
  if (raw == null || raw === '') return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1 || n > TABLE_COUNT) return null
  return n
}

function readSessionMasa(): number | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    return parseMasa(sessionStorage.getItem(MASA_SESSION_KEY))
  } catch {
    return null
  }
}

export type MasaSourceMode = 'url-only' | 'url-or-session'

type UseMasaNumberOptions = {
  /** Müşteri menüsü: yalnızca `?masa=` (QR); oturumdan masa okunmaz. */
  source?: MasaSourceMode
}

export function useMasaNumber(options?: UseMasaNumberOptions) {
  const source = options?.source ?? 'url-or-session'
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const urlMasa = useMemo(
    () => parseMasa(searchParams.get('masa')),
    [searchParams],
  )

  useEffect(() => {
    if (source === 'url-only') return
    if (urlMasa != null) {
      sessionStorage.setItem(MASA_SESSION_KEY, String(urlMasa))
    }
  }, [urlMasa, source])

  const sessionMasa = readSessionMasa()
  const masa = source === 'url-only' ? urlMasa : (urlMasa ?? sessionMasa)

  const setMasa = useCallback(
    (n: number) => {
      if (n < 1 || n > TABLE_COUNT) return
      sessionStorage.setItem(MASA_SESSION_KEY, String(n))
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
