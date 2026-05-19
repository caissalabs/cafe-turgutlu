import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { supabase } from '@/lib/supabaseClient'
import { parseBusinessHoursForRpc, timeToInputValue } from '@/utils/businessHours'
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
  if (t.includes('Açılış ve kapanış saati birlikte girilmelidir')) return t
  if (t.includes('Açılış ve kapanış saatleri farklı olmalıdır')) return t
  return t || 'Kayıt güncellenemedi.'
}

export function AccountPage() {
  useDocumentTitle('CafeNET — Hesabım')
  const { businessId, panelUsername, changePanelPassword } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedHint, setSavedHint] = useState<string | null>(null)

  const [businessName, setBusinessName] = useState('')
  const [managerName, setManagerName] = useState('')
  const [slug, setSlug] = useState('')
  const [openingTime, setOpeningTime] = useState('')
  const [closingTime, setClosingTime] = useState('')
  const [hasSupabaseSession, setHasSupabaseSession] = useState(false)
  const [pwdNew, setPwdNew] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [pwdOk, setPwdOk] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    setError(null)
    try {
      const [{ data: sessionData }, { data: biz, error: bizErr }] = await Promise.all([
        supabase.auth.getSession(),
        supabase
          .from('businesses')
          .select('name, slug, manager_display_name, opening_time, closing_time')
          .eq('id', businessId)
          .single(),
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
      setOpeningTime(timeToInputValue(typeof biz?.opening_time === 'string' ? biz.opening_time : null))
      setClosingTime(timeToInputValue(typeof biz?.closing_time === 'string' ? biz.closing_time : null))
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

  const onProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!businessId) {
      setError('Oturum bilgisi eksik. Tekrar giriş yapın.')
      return
    }

    if (!hasSupabaseSession) {
      setError('Oturum bulunamadı. Tekrar giriş yapın.')
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

    const hrs = parseBusinessHoursForRpc(openingTime, closingTime)
    if (!hrs.ok) {
      setError(hrs.error)
      return
    }

    setSaving(true)
    setError(null)
    setSavedHint(null)

    const { data, error: rpcErr } = await supabase.rpc('update_panel_business_profile', {
      p_business_name: bn,
      p_manager_display_name: mn,
      p_slug: slugNormalized,
      p_username: null,
      p_password: null,
      p_opening_time: hrs.openingTime,
      p_closing_time: hrs.closingTime,
    })

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

    if (typeof o?.opening_time === 'string') setOpeningTime(timeToInputValue(o.opening_time))
    else setOpeningTime('')
    if (typeof o?.closing_time === 'string') setClosingTime(timeToInputValue(o.closing_time))
    else setClosingTime('')

    setSavedHint('İşletme bilgileri kaydedildi.')
  }

  const onPwdSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdError(null)
    setPwdOk(null)

    if (!hasSupabaseSession) {
      setPwdError('Oturum bulunamadı. Tekrar giriş yapın.')
      return
    }

    if (pwdNew !== pwdConfirm) {
      setPwdError('Yeni şifre iki alanda da aynı olmalıdır.')
      return
    }

    setPwdSaving(true)
    const r = await changePanelPassword({ newPassword: pwdNew })
    setPwdSaving(false)

    if (!r.ok) {
      setPwdError(r.error ?? 'Şifre güncellenemedi.')
      return
    }

    setPwdOk('Şifre güncellendi.')
    setPwdNew('')
    setPwdConfirm('')
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
          İşletme bilgilerinizi ve şifrenizi güncelleyebilirsiniz.
        </p>
      </div>

      {loading ? (
        <p className={styles.loading}>Yükleniyor…</p>
      ) : (
        <div className={styles.card}>
          <form id="account-profile-form" className={styles.formBlock} onSubmit={(e) => void onProfileSubmit(e)}>
            <div className={styles.identityLine}>
              <span className={styles.identityLabel}>E-posta</span>
              <span className={styles.identityValue}>{panelUsername ?? ''}</span>
            </div>

            <h2 className={styles.cardTitle}>İşletme</h2>
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

              <div className={styles.hoursRow}>
                <div className={styles.hourField}>
                  <label className={styles.label} htmlFor="account-open">
                    İşyeri açılış saati
                  </label>
                  <input
                    id="account-open"
                    type="time"
                    className={styles.input}
                    step={300}
                    value={openingTime}
                    onChange={(e) => setOpeningTime(e.target.value)}
                  />
                </div>
                <div className={styles.hourField}>
                  <label className={styles.label} htmlFor="account-close">
                    İşyeri kapanış saati
                  </label>
                  <input
                    id="account-close"
                    type="time"
                    className={styles.input}
                    step={300}
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                  />
                </div>
              </div>
              <p className={styles.sectionHint}>
                Her iki saati birlikte doldurun veya ikisini boş bırakın (kayıtta çalışma saati tutulmaz).
              </p>
            </div>

            {error ? (
              <p className={styles.err} role="alert">
                {error}
              </p>
            ) : null}

            <div className={styles.actions}>
              <Button type="submit" disabled={saving}>
                {saving ? 'Kaydediliyor…' : 'İşletmeyi kaydet'}
              </Button>
              {savedHint ? <p className={styles.saved}>{savedHint}</p> : null}
            </div>
          </form>

          <hr className={styles.divider} />

          <form id="account-password-form" className={styles.formBlock} onSubmit={(e) => void onPwdSubmit(e)}>
            <h2 className={styles.cardTitle}>Şifre</h2>
            <p className={styles.sectionHint}>
              E-posta veya Google ile oturum açtıysanız şifreyi doğrudan değiştirebilirsiniz.
            </p>

            <div className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="account-pwd-new">
                  Yeni şifre
                </label>
                <input
                  id="account-pwd-new"
                  type="password"
                  className={styles.input}
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="account-pwd-confirm">
                  Yeni şifre (tekrar)
                </label>
                <input
                  id="account-pwd-confirm"
                  type="password"
                  className={styles.input}
                  value={pwdConfirm}
                  onChange={(e) => setPwdConfirm(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
            </div>

            {pwdError ? (
              <p className={styles.err} role="alert">
                {pwdError}
              </p>
            ) : null}
            {pwdOk ? <p className={styles.saved}>{pwdOk}</p> : null}

            <div className={styles.actions}>
              <Button type="submit" disabled={pwdSaving}>
                {pwdSaving ? 'Güncelleniyor…' : 'Şifreyi güncelle'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
