import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  ADMIN_LOCKOUT_ATTEMPTS,
  ADMIN_LOCKOUT_MS,
  ADMIN_SESSION_KEY,
  ADMIN_SESSION_META_KEY,
  ADMIN_SESSION_TTL_MS,
} from '@/constants/auth'
import { AuthContext, type AuthContextValue } from '@/contexts/auth-context'
import { timingSafeEqual } from '@/utils/timingSafeEqual'

/**
 * İstemci tarafı oturum: şifre tarayıcıya hiç yazılmaz, yalnızca ortam değişkenleri
 * ile sunucuda build zamanında karşılaştırılır. Üretimde gerçek güvenlik için
 * HTTPS + sunucu oturumu (veya JWT + httpOnly çerez) şarttır.
 */

type SessionMeta = { exp: number }

function clearStoredSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY)
  sessionStorage.removeItem(ADMIN_SESSION_META_KEY)
}

function readStoredSession(): boolean {
  try {
    const token = sessionStorage.getItem(ADMIN_SESSION_KEY)
    const rawMeta = sessionStorage.getItem(ADMIN_SESSION_META_KEY)
    if (!token || !rawMeta) return false
    const meta = JSON.parse(rawMeta) as SessionMeta
    if (typeof meta.exp !== 'number' || Date.now() > meta.exp) {
      clearStoredSession()
      return false
    }
    return true
  } catch {
    clearStoredSession()
    return false
  }
}

let failedAttempts = 0
let lockUntil = 0

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => readStoredSession())

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!readStoredSession()) {
        setIsAuthenticated(false)
      }
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const logout = useCallback(() => {
    clearStoredSession()
    setIsAuthenticated(false)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    if (Date.now() < lockUntil) {
      const sec = Math.ceil((lockUntil - Date.now()) / 1000)
      return {
        ok: false,
        error: `Çok fazla hatalı deneme. Yaklaşık ${sec} saniye sonra tekrar deneyin.`,
      }
    }

    const expectedUser = import.meta.env.VITE_ADMIN_USERNAME ?? ''
    const expectedPass = import.meta.env.VITE_ADMIN_PASSWORD ?? ''

    if (!expectedUser || !expectedPass) {
      console.error(
        'Yönetici girişi: VITE_ADMIN_USERNAME ve VITE_ADMIN_PASSWORD .env.local içinde tanımlı olmalı.',
      )
      return {
        ok: false,
        error: 'Sunucu yapılandırması eksik. Yöneticiye başvurun.',
      }
    }

    const userOk = timingSafeEqual(username, expectedUser)
    const passOk = timingSafeEqual(password, expectedPass)

    if (!userOk || !passOk) {
      failedAttempts += 1
      if (failedAttempts >= ADMIN_LOCKOUT_ATTEMPTS) {
        lockUntil = Date.now() + ADMIN_LOCKOUT_MS
        failedAttempts = 0
      }
      await new Promise((r) => setTimeout(r, 350 + Math.random() * 250))
      return { ok: false, error: 'Kullanıcı adı veya şifre hatalı.' }
    }

    failedAttempts = 0
    lockUntil = 0

    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    const exp = Date.now() + ADMIN_SESSION_TTL_MS
    sessionStorage.setItem(ADMIN_SESSION_KEY, token)
    sessionStorage.setItem(ADMIN_SESSION_META_KEY, JSON.stringify({ exp } satisfies SessionMeta))
    setIsAuthenticated(true)
    return { ok: true }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      login,
      logout,
    }),
    [isAuthenticated, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
