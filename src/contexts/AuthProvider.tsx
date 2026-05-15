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
import { DEFAULT_BUSINESS_SLUG, LOCAL_FALLBACK_BUSINESS_ID } from '@/constants/business'
import { AuthContext, type AuthContextValue } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabaseClient'
import { timingSafeEqual } from '@/utils/timingSafeEqual'

type SessionMeta = { exp: number; businessId: string }

function clearStoredSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY)
  sessionStorage.removeItem(ADMIN_SESSION_META_KEY)
}

function readStoredSession(): { ok: boolean; businessId: string | null } {
  try {
    const token = sessionStorage.getItem(ADMIN_SESSION_KEY)
    const rawMeta = sessionStorage.getItem(ADMIN_SESSION_META_KEY)
    if (!token || !rawMeta) return { ok: false, businessId: null }
    const meta = JSON.parse(rawMeta) as SessionMeta
    if (typeof meta.exp !== 'number' || Date.now() > meta.exp || typeof meta.businessId !== 'string') {
      clearStoredSession()
      return { ok: false, businessId: null }
    }
    return { ok: true, businessId: meta.businessId }
  } catch {
    clearStoredSession()
    return { ok: false, businessId: null }
  }
}

let failedAttempts = 0
let lockUntil = 0

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = readStoredSession()
  const [isAuthenticated, setIsAuthenticated] = useState(initial.ok)
  const [businessId, setBusinessId] = useState<string | null>(initial.businessId)

  useEffect(() => {
    const id = window.setInterval(() => {
      const s = readStoredSession()
      if (!s.ok) {
        setIsAuthenticated(false)
        setBusinessId(null)
      }
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const logout = useCallback(() => {
    clearStoredSession()
    setIsAuthenticated(false)
    setBusinessId(null)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    if (Date.now() < lockUntil) {
      const sec = Math.ceil((lockUntil - Date.now()) / 1000)
      return {
        ok: false,
        error: `Çok fazla hatalı deneme. Yaklaşık ${sec} saniye sonra tekrar deneyin.`,
      }
    }

    const user = username.trim()
    /** Yönetici girişi tek işletmeye bağlı; slug env ile değiştirilebilir (çok kiracılı hazırlık). */
    const adminBusinessSlug =
      (import.meta.env.VITE_ADMIN_BUSINESS_SLUG as string | undefined)?.trim().toLowerCase() ||
      DEFAULT_BUSINESS_SLUG

    if (supabase) {
      if (!user || !password) {
        return { ok: false, error: 'Kullanıcı adı ve şifre gerekli.' }
      }
      const { data, error } = await supabase.rpc('login_business', {
        p_slug: adminBusinessSlug,
        p_username: user,
        p_password: password,
      })
      if (error) {
        console.error(error)
        return { ok: false, error: 'Giriş sırasında bir hata oluştu.' }
      }
      const bid = typeof data === 'string' ? data : null
      if (!bid) {
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
      sessionStorage.setItem(
        ADMIN_SESSION_META_KEY,
        JSON.stringify({ exp, businessId: bid } satisfies SessionMeta),
      )
      setBusinessId(bid)
      setIsAuthenticated(true)
      return { ok: true }
    }

    /* Yerel mod: .env ile tek işletme */
    const expectedUser = import.meta.env.VITE_ADMIN_USERNAME ?? ''
    const expectedPass = import.meta.env.VITE_ADMIN_PASSWORD ?? ''

    if (!expectedUser || !expectedPass) {
      console.error(
        'Yerel mod: VITE_ADMIN_USERNAME ve VITE_ADMIN_PASSWORD .env.local içinde tanımlı olmalı.',
      )
      return {
        ok: false,
        error: 'Sunucu yapılandırması eksik. Yöneticiye başvurun.',
      }
    }

    const userOk = timingSafeEqual(user, expectedUser)
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
    const bid =
      (import.meta.env.VITE_LOCAL_BUSINESS_ID as string | undefined)?.trim() ||
      LOCAL_FALLBACK_BUSINESS_ID
    sessionStorage.setItem(ADMIN_SESSION_KEY, token)
    sessionStorage.setItem(
      ADMIN_SESSION_META_KEY,
      JSON.stringify({ exp, businessId: bid } satisfies SessionMeta),
    )
    setBusinessId(bid)
    setIsAuthenticated(true)
    return { ok: true }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      businessId,
      login,
      logout,
    }),
    [isAuthenticated, businessId, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
