import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ADMIN_LOCKOUT_ATTEMPTS,
  ADMIN_LOCKOUT_MS,
  ADMIN_SESSION_KEY,
  ADMIN_SESSION_META_KEY,
  ADMIN_SESSION_TTL_MS,
} from '@/constants/auth'
import {
  AuthContext,
  type AuthContextValue,
  type RegisterGoogleBusinessInput,
  type RegisterInput,
} from '@/contexts/auth-context'
import { supabase } from '@/lib/supabaseClient'

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

function commitSession(businessId: string) {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  const exp = Date.now() + ADMIN_SESSION_TTL_MS
  sessionStorage.setItem(ADMIN_SESSION_KEY, token)
  sessionStorage.setItem(
    ADMIN_SESSION_META_KEY,
    JSON.stringify({ exp, businessId } satisfies SessionMeta),
  )
}

function oauthRedirectBase(): string {
  const env = import.meta.env.VITE_SITE_URL?.trim()
  if (env) return env.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '')
  return ''
}

let loginFailedAttempts = 0
let loginLockUntil = 0

let registerFailedAttempts = 0
let registerLockUntil = 0

function rpcErrorMessage(err: { message?: string } | null): string {
  const raw = err?.message ?? ''
  if (raw.includes('Geçersiz işletme')) return 'İşletme adı, kısa adres veya şifre geçersiz. Şifre en az 8 karakter olmalıdır.'
  if (raw.includes('zaten kullanılıyor')) return 'Bu kısa adres veya kullanıcı adı zaten kullanılıyor.'
  if (raw.includes('Bu kısa adres zaten')) return 'Bu kısa adres zaten kullanılıyor.'
  if (raw.includes('Bu Google hesabı zaten')) return 'Bu Google hesabı zaten bir işletmeye bağlı.'
  if (raw.includes('Oturum gerekli')) return 'Oturum süresi dolmuş. Tekrar Google ile giriş yapın.'
  return raw.trim() || 'İşlem sırasında bir hata oluştu.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const skipClearSessionOnSignOutRef = useRef(false)

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

  useEffect(() => {
    let cancelled = false

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return

      if (event === 'SIGNED_OUT') {
        if (!skipClearSessionOnSignOutRef.current) {
          clearStoredSession()
        }
        setIsAuthenticated(false)
        setBusinessId(null)
        return
      }

      if (event === 'INITIAL_SESSION') {
        const stored = readStoredSession()
        if (stored.ok && stored.businessId) {
          setIsAuthenticated(true)
          setBusinessId(stored.businessId)
        }

        if (session?.user) {
          const { data, error } = await supabase.rpc('get_business_id_for_auth_user')
          if (!cancelled && !error && typeof data === 'string') {
            commitSession(data)
            setIsAuthenticated(true)
            setBusinessId(data)
          }
        }
        return
      }

      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        const { data, error } = await supabase.rpc('get_business_id_for_auth_user')
        if (!cancelled && !error && typeof data === 'string') {
          commitSession(data)
          setIsAuthenticated(true)
          setBusinessId(data)
        }
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const logout = useCallback(async () => {
    clearStoredSession()
    setIsAuthenticated(false)
    setBusinessId(null)
    await supabase.auth.signOut()
  }, [])

  const login = useCallback(async (slug: string, username: string, password: string) => {
    if (Date.now() < loginLockUntil) {
      const sec = Math.ceil((loginLockUntil - Date.now()) / 1000)
      return {
        ok: false,
        error: `Çok fazla hatalı deneme. Yaklaşık ${sec} saniye sonra tekrar deneyin.`,
      }
    }

    const s = slug.trim().toLowerCase()
    const user = username.trim()
    if (!s || !user || !password) {
      return { ok: false, error: 'Kısa adres, kullanıcı adı ve şifre gerekli.' }
    }

    const { data: sessionData } = await supabase.auth.getSession()
    if (sessionData.session) {
      skipClearSessionOnSignOutRef.current = true
      try {
        await supabase.auth.signOut()
      } finally {
        skipClearSessionOnSignOutRef.current = false
      }
    }

    const { data, error } = await supabase.rpc('login_business', {
      p_slug: s,
      p_username: user,
      p_password: password,
    })
    if (error) {
      console.error(error)
      return { ok: false, error: 'Giriş sırasında bir hata oluştu.' }
    }
    const bid = typeof data === 'string' ? data : null
    if (!bid) {
      loginFailedAttempts += 1
      if (loginFailedAttempts >= ADMIN_LOCKOUT_ATTEMPTS) {
        loginLockUntil = Date.now() + ADMIN_LOCKOUT_MS
        loginFailedAttempts = 0
      }
      await new Promise((r) => setTimeout(r, 350 + Math.random() * 250))
      return { ok: false, error: 'Kısa adres, kullanıcı adı veya şifre hatalı.' }
    }
    loginFailedAttempts = 0
    loginLockUntil = 0
    commitSession(bid)
    setBusinessId(bid)
    setIsAuthenticated(true)
    return { ok: true }
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    if (Date.now() < registerLockUntil) {
      const sec = Math.ceil((registerLockUntil - Date.now()) / 1000)
      return {
        ok: false,
        error: `Çok fazla deneme. Yaklaşık ${sec} saniye sonra tekrar deneyin.`,
      }
    }

    const businessName = input.businessName.trim()
    const slug = input.slug.trim().toLowerCase().replace(/\s+/g, '-')
    const username = input.username.trim()
    const password = input.password

    if (!businessName || !slug || !username || !password) {
      return { ok: false, error: 'Tüm alanları doldurun.' }
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 2) {
      return {
        ok: false,
        error: 'Kısa adres yalnızca küçük harf, rakam ve tire içerebilir (ör. benim-kafe).',
      }
    }
    if (username.length < 2) {
      return { ok: false, error: 'Kullanıcı adı en az 2 karakter olmalıdır.' }
    }
    if (password.length < 8) {
      return { ok: false, error: 'Şifre en az 8 karakter olmalıdır.' }
    }

    const { data: sessionData } = await supabase.auth.getSession()
    if (sessionData.session) {
      skipClearSessionOnSignOutRef.current = true
      try {
        await supabase.auth.signOut()
      } finally {
        skipClearSessionOnSignOutRef.current = false
      }
    }

    const { data, error } = await supabase.rpc('register_business', {
      p_name: businessName,
      p_slug: slug,
      p_username: username,
      p_password: password,
    })

    if (error) {
      console.error(error)
      registerFailedAttempts += 1
      if (registerFailedAttempts >= ADMIN_LOCKOUT_ATTEMPTS) {
        registerLockUntil = Date.now() + ADMIN_LOCKOUT_MS
        registerFailedAttempts = 0
      }
      return { ok: false, error: rpcErrorMessage(error) }
    }

    const bid = typeof data === 'string' ? data : null
    if (!bid) {
      return { ok: false, error: 'Kayıt tamamlanamadı.' }
    }

    registerFailedAttempts = 0
    registerLockUntil = 0
    commitSession(bid)
    setBusinessId(bid)
    setIsAuthenticated(true)
    return { ok: true }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    clearStoredSession()
    setIsAuthenticated(false)
    setBusinessId(null)
    await supabase.auth.signOut()

    const base = oauthRedirectBase()
    if (!base) {
      return { ok: false, error: 'Site adresi alınamadı.' }
    }
    const redirectTo = `${base}/auth/callback`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    })
    if (error) {
      console.error(error)
      return { ok: false, error: error.message || 'Google ile giriş başlatılamadı.' }
    }
    return { ok: true }
  }, [])

  const registerBusinessWithGoogle = useCallback(async (input: RegisterGoogleBusinessInput) => {
    const businessName = input.businessName.trim()
    const slug = input.slug.trim().toLowerCase().replace(/\s+/g, '-')

    if (!businessName || !slug) {
      return { ok: false, error: 'İşletme adı ve kısa adres gerekli.' }
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 2) {
      return {
        ok: false,
        error: 'Kısa adres yalnızca küçük harf, rakam ve tire içerebilir (ör. benim-kafe).',
      }
    }

    const { data, error } = await supabase.rpc('register_business_with_google', {
      p_name: businessName,
      p_slug: slug,
    })

    if (error) {
      console.error(error)
      return { ok: false, error: rpcErrorMessage(error) }
    }

    const bid = typeof data === 'string' ? data : null
    if (!bid) {
      return { ok: false, error: 'Kayıt tamamlanamadı.' }
    }

    commitSession(bid)
    setBusinessId(bid)
    setIsAuthenticated(true)
    return { ok: true }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      businessId,
      login,
      register,
      signInWithGoogle,
      registerBusinessWithGoogle,
      logout,
    }),
    [
      isAuthenticated,
      businessId,
      login,
      register,
      signInWithGoogle,
      registerBusinessWithGoogle,
      logout,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
