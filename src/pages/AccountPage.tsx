import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { supabase } from '@/lib/supabaseClient'
import styles from './AccountPage.module.css'

function rpcProfileErrorMessage(raw: string): string {
  const t = raw.trim()
  if (t.includes('İşletme adı ve yönetici adı gerekli')) return t
  if (t.includes('Geçersiz kısa adres'))
    return 'Kısa adres yalnızca küçük harf, rakam ve tire içerebilir.'
  if (t.includes('Bu kısa adres zaten kullanılıyor')) return t
  if (t.includes('Kimlik doğrulanamadı')) return 'Şifre hatalı.'
  if (t.includes('Oturum veya şifre gerekli'))
    return 'Kaydetmek için panel şifrenizi girin veya oturumunuzun açık olduğundan emin olun.'
  if (t.includes('İşletme kaydı bulunamadı')) return t
  return t || 'Kayıt güncellenemedi.'
}

export function AccountPage() {
  useDocumentTitle('CafeNET — Hesabım')
  const { businessId, panelUsername } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedHint, setSavedHint] = useState<string | null>(null)

  const [businessName, setBusinessName] = useState('')
  const [managerName, setManagerName] = useState('')
  const [slug, setSlug] = useState('')
  const [emailDisplay, setEmailDisplay] = useState<string | null>(null)
  const [hasSupabaseSession, setHasSupabaseSession] = useState(false)
  const [panelPassword, setPanelPassword] = useState('')

  const showPasswordFields = !hasSupabaseSession

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    setError(null)
    try {
      const [{ data: sessionData }, { data: biz, error: bizErr }, userRes] = await Promise.all([
        supabase.auth.getSession(),
        supabase
          .from('businesses')
          .select('name, slug, manager_display_name')
          .eq('id', businessId)
          .single(),
        supabase.auth.getUser(),
      ])

      setHasSupabaseSession(Boolean(sessionData.session))

      if (bizErr) {
        console.error(bizErr)
        setError('İşletme bilgileri yüklenemedi.')
        return
      }

      setBusinessName(typeof biz?.name === 'string' ? biz.name : '')
      setSlug(typeof biz?.slug === 'string' ? biz.slug : '')
      setManagerName(typeof biz?.manager_display_name === 'string' ? biz.manager_display_name : '')

      const mail = userRes.data.user?.email?.trim()
      setEmailDisplay(mail && mail.length > 0 ? mail : null)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSupabaseSession(Boolean(session))
    })
    return () => subscription.unsubscribe()
  }, [])

  const slugNormalized = useMemo(
    () => slug.trim().toLowerCase().replace(/\s+/g, '-'),
    [slug],
  )

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!businessId || !panelUsername?.trim()) {
      setError('Oturum bilgisi eksik. Tekrar giriş yapın.')
      return
    }

    const bn = businessName.trim()
    const mn = managerName.trim()
    if (!bn || !mn) {
      setError('İşletme adı ve yönetici adı gerekli.')
      return
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugNormalized) || slugNormalized.length < 2) {
      setError('Kısa adres yalnızca küçük harf, rakam ve tire içerebilir.')
      return
    }

    if (showPasswordFields && panelPassword.length < 8) {
      setError('Kaydetmek için panel şifrenizi girin (en az 8 karakter).')
      return
    }

    setSaving(true)
    setError(null)
    setSavedHint(null)

    const rpcArgs: Record<string, string | null> = {
      p_business_name: bn,
      p_manager_display_name: mn,
      p_slug: slugNormalized,
      p_username: showPasswordFields ? panelUsername.trim() : null,
      p_password: showPasswordFields ? panelPassword : null,
    }

    const { data, error: rpcErr } = await supabase.rpc('update_panel_business_profile', rpcArgs)

    setSaving(false)

    if (rpcErr) {
      console.error(rpcErr)
      setError(rpcProfileErrorMessage(rpcErr.message ?? ''))
      return
    }

    const o = data as Record<string, unknown> | null
    if (o && typeof o.slug === 'string') setSlug(o.slug)
    if (o && typeof o.name === 'string') setBusinessName(o.name)
    if (o && typeof o.manager_display_name === 'string') setManagerName(o.manager_display_name)

    setSavedHint('Değişiklikler kaydedildi.')
    setPanelPassword('')
  }

  if (!businessId) {
    return (
      <section className={styles.stack}>
        <p className={styles.err} role="alert">
          Oturum bulunamadı.
        </p>
      </section>
    )
  }

  return (
    <section className={styles.stack}>
      <div>
        <h1 className={styles.title}>Hesabım</h1>
        <p className={styles.lead}>
          İşletme bilgilerinizi güncelleyin. Kullanıcı adı, e-posta ve şifre bu ekrandan
          değiştirilmez.
        </p>
      </div>

      {loading ? (
        <p className={styles.loading}>Yükleniyor…</p>
      ) : (
        <form className={styles.card} onSubmit={(e) => void onSubmit(e)}>
          <h2 className={styles.cardTitle}>Kimlik (salt okunur)</h2>
          <p className={styles.sectionHint}>
            Bu alanlar sunucudaki oturum ve hesap kaydıyla ilişkilidir; düzenleme için destek veya
            şifre sıfırlama akışlarını kullanın.
          </p>
          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="account-username">
                Kullanıcı adı
              </label>
              <input
                id="account-username"
                className={`${styles.input} ${styles.inputReadonly}`}
                readOnly
                value={panelUsername ?? ''}
                autoComplete="username"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="account-email">
                E-posta
              </label>
              <input
                id="account-email"
                className={`${styles.input} ${styles.inputReadonly}`}
                readOnly
                value={
                  emailDisplay ??
                  'Bu oturumda e-posta yok (yalnızca kullanıcı adı ile giriş). Google veya e-posta ile girişte adres burada görünür.'
                }
              />
            </div>
          </div>

          <h2 className={styles.cardTitle}>İşletme bilgileri</h2>
          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="account-business-name">
                İşletme adı
              </label>
              <input
                id="account-business-name"
                className={styles.input}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                autoComplete="organization"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="account-manager">
                Yönetici görünen adı
              </label>
              <input
                id="account-manager"
                className={styles.input}
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="account-slug">
                Kısa adres (menü URL&apos;si)
              </label>
              <input
                id="account-slug"
                className={styles.input}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                spellCheck={false}
                autoCapitalize="none"
              />
            </div>

            {showPasswordFields ? (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="account-panel-password">
                  Panel şifresi (doğrulama)
                </label>
                <input
                  id="account-panel-password"
                  type="password"
                  className={styles.input}
                  value={panelPassword}
                  onChange={(e) => setPanelPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Değişiklikleri kaydetmek için şifreniz"
                />
                <p className={styles.sectionHint}>
                  Yalnızca kullanıcı adı ile giriş yaptığınızda güvenlik için şifre sorulur.
                </p>
              </div>
            ) : null}
          </div>

          {error ? (
            <p className={styles.err} role="alert">
              {error}
            </p>
          ) : null}

          <div className={styles.actions}>
            <Button type="submit" disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
            {savedHint ? <p className={styles.saved}>{savedHint}</p> : null}
          </div>
        </form>
      )}
    </section>
  )
}
