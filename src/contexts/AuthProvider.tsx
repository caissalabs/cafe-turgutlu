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
  type AuthMethod,
  type CompleteOnboardingGoogleInput,
  type CompleteOnboardingPasswordInput,
  type RegisterInput,
} from '@/contexts/auth-context'
import { supabase } from '@/lib/supabaseClient'
import { oauthRedirectBase } from '@/utils/oauthRedirectBase'

type SessionMeta = {
  exp: number
  businessId: string
  active: boolean
  onboardingComplete: boolean
  username: string
  authMethod: AuthMethod
}

type PanelRpcPayload = {
  business_id: string
  active: boolean
  onboarding_complete: boolean
  username?: string
}

function parsePanelRpcPayload(data: unknown): PanelRpcPayload | null {
  if (!data || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  const bid = o.business_id
  if (typeof bid !== 'string') return null
  return {
    business_id: bid,
    active: Boolean(o.active),
    onboarding_complete: Boolean(o.onboarding_complete),
    username: typeof o.username === 'string' ? o.username : undefined,
  }
}

function clearStoredSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY)
  sessionStorage.removeItem(ADMIN_SESSION_META_KEY)
}

function readStoredSession(): {
  ok: boolean
  businessId: string | null
  active: boolean
  onboardingComplete: boolean
  username: string | null
  authMethod: AuthMethod | null
} {
  try {
    const token = sessionStorage.getItem(ADMIN_SESSION_KEY)
    const rawMeta = sessionStorage.getItem(ADMIN_SESSION_META_KEY)
    if (!token || !rawMeta) {
      return {
        ok: false,
        businessId: null,
        active: false,
        onboardingComplete: false,
        username: null,
        authMethod: null,
      }
    }
    const meta = JSON.parse(rawMeta) as Partial<SessionMeta>
    if (
      typeof meta.exp !== 'number' ||
      Date.now() > meta.exp ||
      typeof meta.businessId !== 'string' ||
      typeof meta.active !== 'boolean' ||
      typeof meta.onboardingComplete !== 'boolean' ||
      typeof meta.username !== 'string' ||
      (meta.authMethod !== 'oauth' &&
        meta.authMethod !== 'password' &&
        meta.authMethod !== 'email')
    ) {
      clearStoredSession()
      return {
        ok: false,
        businessId: null,
        active: false,
        onboardingComplete: false,
        username: null,
        authMethod: null,
      }
    }
    return {
      ok: true,
      businessId: meta.businessId,
      active: meta.active,
      onboardingComplete: meta.onboardingComplete,
      username: meta.username,
      authMethod: meta.authMethod,
    }
  } catch {
    clearStoredSession()
    return {
      ok: false,
      businessId: null,
      active: false,
      onboardingComplete: false,
      username: null,
      authMethod: null,
    }
  }
}

function commitSessionFull(p: PanelRpcPayload, authMethod: AuthMethod, usernameFallback?: string) {
  const username = p.username?.trim() || usernameFallback?.trim() || ''
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  const exp = Date.now() + ADMIN_SESSION_TTL_MS
  sessionStorage.setItem(ADMIN_SESSION_KEY, token)
  const meta: SessionMeta = {
    exp,
    businessId: p.business_id,
    active: p.active,
    onboardingComplete: p.onboarding_complete,
    username,
    authMethod,
  }
  sessionStorage.setItem(ADMIN_SESSION_META_KEY, JSON.stringify(meta))
}

function writeMetaMerge(partial: Partial<Pick<SessionMeta, 'active' | 'onboardingComplete'>>) {
  try {
    const token = sessionStorage.getItem(ADMIN_SESSION_KEY)
    const rawMeta = sessionStorage.getItem(ADMIN_SESSION_META_KEY)
    if (!token || !rawMeta) return
    const meta = JSON.parse(rawMeta) as SessionMeta
    const next: SessionMeta = {
      ...meta,
      exp: Date.now() + ADMIN_SESSION_TTL_MS,
      ...(partial.active !== undefined ? { active: partial.active } : {}),
      ...(partial.onboardingComplete !== undefined
        ? { onboardingComplete: partial.onboardingComplete }
        : {}),
    }
    sessionStorage.setItem(ADMIN_SESSION_META_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

let loginFailedAttempts = 0
let loginLockUntil = 0

let registerFailedAttempts = 0
let registerLockUntil = 0

function rpcErrorMessage(err: { message?: string } | null): string {
  const raw = err?.message ?? ''
  if (raw.includes('Geçersiz kullanıcı')) return 'Kullanıcı adı veya şifre geçersiz. Şifre en az 8 karakter olmalıdır.'
  if (raw.includes('Geçersiz işletme')) return 'İşletme bilgileri geçersiz.'
  if (raw.includes('Kimlik doğrulanamadı')) return 'Şifre hatalı.'
  if (raw.includes('zaten kullanılıyor'))
    return 'Bu kullanıcı adı, e-posta veya kısa adres zaten kullanılıyor.'
  if (raw.includes('Bu Google hesabı zaten')) return 'Bu Google hesabı zaten bir işletmeye bağlı.'
  if (raw.includes('Oturum gerekli')) return 'Oturum süresi dolmuş. Tekrar giriş yapın.'
  if (raw.includes('Geçerli bir e-posta')) return 'Geçerli bir e-posta adresi girin.'
  if (raw.includes('Panel kaydı bağlanamadı')) return raw.trim()
  if (raw.includes('bekleyen kayıt yok')) return raw.trim()
  if (raw.includes('İşletme kullanıcısı bulunamadı')) return raw.trim()
  return raw.trim() || 'İşlem sırasında bir hata oluştu.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const skipClearSessionOnSignOutRef = useRef(false)

  const initial = readStoredSession()
  const [isAuthenticated, setIsAuthenticated] = useState(initial.ok)
  const [businessId, setBusinessId] = useState<string | null>(initial.businessId)
  const [active, setActive] = useState(initial.ok ? initial.active : false)
  const [onboardingComplete, setOnboardingComplete] = useState(
    initial.ok ? initial.onboardingComplete : false,
  )
  const [panelUsername, setPanelUsername] = useState<string | null>(initial.username)
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(initial.authMethod)

  const applyPayload = useCallback(
    (payload: PanelRpcPayload, method: AuthMethod, usernameFallback?: string) => {
      commitSessionFull(payload, method, usernameFallback)
      setBusinessId(payload.business_id)
      setActive(payload.active)
      setOnboardingComplete(payload.onboarding_complete)
      setPanelUsername(payload.username?.trim() || usernameFallback?.trim() || null)
      setAuthMethod(method)
      setIsAuthenticated(true)
    },
    [],
  )

  const syncOAuthPanelSession = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) return

    const rawProvider = session.user.app_metadata?.provider
    const method: AuthMethod = rawProvider === 'google' ? 'oauth' : 'email'

    const { data, error } = await supabase.rpc('get_panel_state_for_auth_user')
    if (error) {
      console.error(error)
      return
    }
    const parsed = parsePanelRpcPayload(data)
    if (!parsed) return
    applyPayload(parsed, method)
  }, [applyPayload])

  useEffect(() => {
    const id = window.setInterval(() => {
      const s = readStoredSession()
      if (!s.ok) {
        setIsAuthenticated(false)
        setBusinessId(null)
        setActive(false)
        setOnboardingComplete(false)
        setPanelUsername(null)
        setAuthMethod(null)
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
        setActive(false)
        setOnboardingComplete(false)
        setPanelUsername(null)
        setAuthMethod(null)
        return
      }

      if (event === 'INITIAL_SESSION') {
        const stored = readStoredSession()
        if (stored.ok && stored.businessId) {
          setIsAuthenticated(true)
          setBusinessId(stored.businessId)
          setActive(stored.active)
          setOnboardingComplete(stored.onboardingComplete)
          setPanelUsername(stored.username)
          setAuthMethod(stored.authMethod)
        }

        if (
          session?.user &&
          (!stored.ok || stored.authMethod === 'oauth' || stored.authMethod === 'email')
        ) {
          await syncOAuthPanelSession()
        }
        return
      }

      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        const storedNow = readStoredSession()
        if (
          !storedNow.ok ||
          storedNow.authMethod === 'oauth' ||
          storedNow.authMethod === 'email'
        ) {
          await syncOAuthPanelSession()
        }
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [syncOAuthPanelSession])

  const logout = useCallback(async () => {
    clearStoredSession()
    setIsAuthenticated(false)
    setBusinessId(null)
    setActive(false)
    setOnboardingComplete(false)
    setPanelUsername(null)
    setAuthMethod(null)
    await supabase.auth.signOut()
  }, [])

  const refreshActivationFromDb = useCallback(async () => {
    const bid = businessId
    if (!bid) return
    const { data, error } = await supabase.rpc('revalidate_business_flags', {
      p_business_id: bid,
    })
    if (error) {
      console.error(error)
      return
    }
    const o = data as Record<string, unknown> | null
    if (!o || typeof o.active !== 'boolean' || typeof o.onboarding_complete !== 'boolean') return
    setActive(o.active)
    setOnboardingComplete(o.onboarding_complete)
    writeMetaMerge({ active: o.active, onboardingComplete: o.onboarding_complete })
  }, [businessId])

  const login = useCallback(
    async (identifier: string, password: string) => {
      if (Date.now() < loginLockUntil) {
        const sec = Math.ceil((loginLockUntil - Date.now()) / 1000)
        return {
          ok: false,
          error: `Çok fazla hatalı deneme. Yaklaşık ${sec} saniye sonra tekrar deneyin.`,
        }
      }

      const id = identifier.trim()
      if (!id || !password) {
        return { ok: false, error: 'E-posta veya kullanıcı adı ve şifre gerekli.' }
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

      if (id.includes('@')) {
        const email = id.toLowerCase()
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          console.error(error)
          loginFailedAttempts += 1
          if (loginFailedAttempts >= ADMIN_LOCKOUT_ATTEMPTS) {
            loginLockUntil = Date.now() + ADMIN_LOCKOUT_MS
            loginFailedAttempts = 0
          }
          await new Promise((r) => setTimeout(r, 350 + Math.random() * 250))
          return { ok: false, error: 'E-posta veya şifre hatalı.' }
        }

        await syncOAuthPanelSession()
        const stored = readStoredSession()
        if (!stored.ok) {
          await supabase.auth.signOut()
          loginFailedAttempts += 1
          return {
            ok: false,
            error:
              'Bu e-posta ile kayıtlı panel hesabı bulunamadı. Önce işletme kaydı oluşturduğunuzdan emin olun.',
          }
        }

        loginFailedAttempts = 0
        loginLockUntil = 0
        return { ok: true }
      }

      const { data, error } = await supabase.rpc('login_user', {
        p_username: id,
        p_password: password,
      })
      if (error) {
        console.error(error)
        return { ok: false, error: 'Giriş sırasında bir hata oluştu.' }
      }

      const parsed = parsePanelRpcPayload(data)
      if (!parsed) {
        loginFailedAttempts += 1
        if (loginFailedAttempts >= ADMIN_LOCKOUT_ATTEMPTS) {
          loginLockUntil = Date.now() + ADMIN_LOCKOUT_MS
          loginFailedAttempts = 0
        }
        await new Promise((r) => setTimeout(r, 350 + Math.random() * 250))
        return { ok: false, error: 'Kullanıcı adı veya şifre hatalı.' }
      }

      loginFailedAttempts = 0
      loginLockUntil = 0
      applyPayload(parsed, 'password', id)
      return { ok: true }
    },
    [applyPayload, syncOAuthPanelSession],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      if (Date.now() < registerLockUntil) {
        const sec = Math.ceil((registerLockUntil - Date.now()) / 1000)
        return {
          ok: false,
          error: `Çok fazla deneme. Yaklaşık ${sec} saniye sonra tekrar deneyin.`,
        }
      }

      const username = input.username.trim()
      const password = input.password
      const email = input.email.trim().toLowerCase()

      if (!username || !password) {
        return { ok: false, error: 'Kullanıcı adı ve şifre gerekli.' }
      }
      if (!email.includes('@') || email.length < 5) {
        return { ok: false, error: 'Geçerli bir e-posta adresi girin.' }
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

      const { error: regErr } = await supabase.rpc('register_user', {
        p_username: username,
        p_password: password,
        p_email: email,
      })

      if (regErr) {
        console.error(regErr)
        registerFailedAttempts += 1
        if (registerFailedAttempts >= ADMIN_LOCKOUT_ATTEMPTS) {
          registerLockUntil = Date.now() + ADMIN_LOCKOUT_MS
          registerFailedAttempts = 0
        }
        return { ok: false, error: rpcErrorMessage(regErr) }
      }

      const base = oauthRedirectBase()
      const { data: signData, error: signErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: base ? `${base}/auth/callback` : undefined,
          data: {
            panel_username: username,
          },
        },
      })

      if (signErr) {
        console.error(signErr)
        return {
          ok: false,
          error:
            signErr.message ||
            'İşletme oluşturuldu ancak oturum bağlantısı kurulamadı. Destek ile iletişime geçin.',
        }
      }

      if (!signData.session) {
        if (signData.user?.id) {
          registerFailedAttempts = 0
          registerLockUntil = 0
          return { ok: true, needsEmailConfirmation: true }
        }
        return {
          ok: false,
          error:
            'Oturum oluşturulamadı. E-posta doğrulamasını kontrol edin veya tekrar deneyin.',
        }
      }

      const { data: linkData, error: linkErr } = await supabase.rpc('link_password_panel_to_auth', {
        p_username: username,
      })

      if (linkErr) {
        console.error(linkErr)
        await supabase.auth.signOut()
        return { ok: false, error: rpcErrorMessage(linkErr) }
      }

      const parsed = parsePanelRpcPayload(linkData)
      if (!parsed) {
        await supabase.auth.signOut()
        return { ok: false, error: 'Panel bağlantısı tamamlanamadı.' }
      }

      registerFailedAttempts = 0
      registerLockUntil = 0
      applyPayload(parsed, 'email', username)
      return { ok: true }
    },
    [applyPayload],
  )

  const requestPasswordReset = useCallback(async (email: string) => {
    const e = email.trim().toLowerCase()
    if (!e.includes('@')) {
      return { ok: false, error: 'Geçerli bir e-posta adresi girin.' }
    }
    const base = oauthRedirectBase()
    if (!base) {
      return { ok: false, error: 'Site adresi alınamadı.' }
    }
    const { error } = await supabase.auth.resetPasswordForEmail(e, {
      redirectTo: `${base}/auth/sifre-yenile`,
    })
    if (error) {
      console.error(error)
      return { ok: false, error: error.message || 'E-posta gönderilemedi.' }
    }
    return { ok: true }
  }, [])

  const completePasswordRecovery = useCallback(
    async (newPassword: string) => {
      if (newPassword.length < 8) {
        return { ok: false, error: 'Şifre en az 8 karakter olmalıdır.' }
      }
      const { error: uErr } = await supabase.auth.updateUser({ password: newPassword })
      if (uErr) {
        return { ok: false, error: uErr.message || 'Şifre güncellenemedi.' }
      }
      const { error: sErr } = await supabase.rpc('sync_business_user_password', {
        p_password: newPassword,
      })
      if (sErr) {
        console.error(sErr)
        return { ok: false, error: rpcErrorMessage(sErr) }
      }
      await syncOAuthPanelSession()
      return { ok: true }
    },
    [syncOAuthPanelSession],
  )

  const completeOnboardingPassword = useCallback(
    async (input: CompleteOnboardingPasswordInput) => {
      const user = panelUsername?.trim()
      if (!user) {
        return { ok: false, error: 'Oturum bilgisi eksik. Tekrar giriş yapın.' }
      }

      const slug = input.slug.trim().toLowerCase().replace(/\s+/g, '-')
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 2) {
        return {
          ok: false,
          error: 'Kısa adres yalnızca küçük harf, rakam ve tire içerebilir.',
        }
      }

      const { data, error } = await supabase.rpc('complete_business_onboarding', {
        p_username: user,
        p_password: input.password,
        p_business_name: input.businessName.trim(),
        p_manager_name: input.managerName.trim(),
        p_slug: slug,
      })

      if (error) {
        console.error(error)
        return { ok: false, error: rpcErrorMessage(error) }
      }

      const parsed = parsePanelRpcPayload(data)
      if (!parsed) {
        return { ok: false, error: 'Kayıt güncellenemedi.' }
      }

      applyPayload(parsed, 'password', user)
      return { ok: true }
    },
    [applyPayload, panelUsername],
  )

  const completeOnboardingGoogle = useCallback(
    async (input: CompleteOnboardingGoogleInput) => {
      const slug = input.slug.trim().toLowerCase().replace(/\s+/g, '-')
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 2) {
        return {
          ok: false,
          error: 'Kısa adres yalnızca küçük harf, rakam ve tire içerebilir.',
        }
      }

      const { data, error } = await supabase.rpc('complete_business_onboarding_google', {
        p_business_name: input.businessName.trim(),
        p_manager_name: input.managerName.trim(),
        p_slug: slug,
      })

      if (error) {
        console.error(error)
        return { ok: false, error: rpcErrorMessage(error) }
      }

      const parsed = parsePanelRpcPayload(data)
      if (!parsed) {
        return { ok: false, error: 'Kayıt güncellenemedi.' }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const rawProvider = session?.user?.app_metadata?.provider
      const method: AuthMethod = rawProvider === 'google' ? 'oauth' : 'email'

      const u = panelUsername ?? parsed.username
      applyPayload(parsed, method, u ?? undefined)
      return { ok: true }
    },
    [applyPayload, panelUsername],
  )

  const signInWithGoogle = useCallback(async () => {
    clearStoredSession()
    setIsAuthenticated(false)
    setBusinessId(null)
    setActive(false)
    setOnboardingComplete(false)
    setPanelUsername(null)
    setAuthMethod(null)
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

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      businessId,
      onboardingComplete,
      active,
      panelUsername,
      authMethod,
      login,
      register,
      requestPasswordReset,
      completePasswordRecovery,
      completeOnboardingPassword,
      completeOnboardingGoogle,
      signInWithGoogle,
      syncOAuthPanelSession,
      refreshActivationFromDb,
      logout,
    }),
    [
      isAuthenticated,
      businessId,
      onboardingComplete,
      active,
      panelUsername,
      authMethod,
      login,
      register,
      requestPasswordReset,
      completePasswordRecovery,
      completeOnboardingPassword,
      completeOnboardingGoogle,
      signInWithGoogle,
      syncOAuthPanelSession,
      refreshActivationFromDb,
      logout,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
