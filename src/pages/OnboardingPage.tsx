import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import styles from './LoginPage.module.css'

export function OnboardingPage() {
  useDocumentTitle('CafeNET — İşletme kurulumu')
  const navigate = useNavigate()
  const {
    authMethod,
    panelUsername,
    completeOnboardingPassword,
    completeOnboardingGoogle,
    isAuthenticated,
    onboardingComplete,
    active,
    logout,
  } = useAuth()

  const [businessName, setBusinessName] = useState('')
  const [managerName, setManagerName] = useState('')
  const [openingTime, setOpeningTime] = useState('09:00')
  const [closingTime, setClosingTime] = useState('22:00')
  const [slug, setSlug] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return
    if (onboardingComplete && !active) navigate('/beklemede', { replace: true })
    else if (onboardingComplete && active) navigate('/home', { replace: true })
  }, [isAuthenticated, onboardingComplete, active, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (authMethod === 'oauth' || authMethod === 'email') {
        const result = await completeOnboardingGoogle({
          businessName,
          managerName,
          slug,
          openingTime,
          closingTime,
        })
        if (result.ok) {
          navigate('/', { replace: true })
        } else {
          setError(result.error ?? 'Kayıt tamamlanamadı.')
        }
      } else {
        if (!password) {
          setError('Onayı tamamlamak için şifrenizi girin.')
          setBusy(false)
          return
        }
        const result = await completeOnboardingPassword({
          businessName,
          managerName,
          slug,
          openingTime,
          closingTime,
          password,
        })
        if (result.ok) {
          setPassword('')
          navigate('/', { replace: true })
        } else {
          setError(result.error ?? 'Kayıt tamamlanamadı.')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  const oauth = authMethod === 'oauth' || authMethod === 'email'

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>İşletmenizi tanımlayın</h1>
        <p className={styles.subtitle}>
          Müşteri menüsü bağlantısı için kısa adresi belirleyin. Bilgiler onay sonrası yayına alınır.
        </p>

        {panelUsername ? (
          <p className={styles.switchRow}>
            Hesap:{' '}
            <strong>
              {authMethod === 'oauth'
                ? 'Google ile bağlı'
                : authMethod === 'email'
                  ? `${panelUsername} (e-posta ile)`
                  : panelUsername}
            </strong>
          </p>
        ) : null}

        <form className={styles.form} onSubmit={handleSubmit} autoComplete="on">
          <div className={styles.field}>
            <label className={styles.label} htmlFor="onb-biz">
              İşletme adı
            </label>
            <input
              id="onb-biz"
              name="business_name"
              className={styles.input}
              type="text"
              autoComplete="organization"
              required
              maxLength={120}
              value={businessName}
              onChange={(ev) => setBusinessName(ev.target.value)}
              disabled={busy}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="onb-mgr">
              Yönetici adı soyadı
            </label>
            <input
              id="onb-mgr"
              name="manager_name"
              className={styles.input}
              type="text"
              autoComplete="name"
              required
              maxLength={120}
              value={managerName}
              onChange={(ev) => setManagerName(ev.target.value)}
              disabled={busy}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="onb-slug">
              Menü kısa adresi (URL)
            </label>
            <input
              id="onb-slug"
              name="business_slug"
              className={styles.input}
              type="text"
              placeholder="ornek: benim-kafe"
              required
              maxLength={64}
              value={slug}
              onChange={(ev) => setSlug(ev.target.value.toLowerCase())}
              disabled={busy}
            />
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.hourField}>
              <label className={styles.label} htmlFor="onb-open">
                İşyeri açılış saati
              </label>
              <input
                id="onb-open"
                name="opening_time"
                className={styles.input}
                type="time"
                step={300}
                required
                value={openingTime}
                onChange={(ev) => setOpeningTime(ev.target.value)}
                disabled={busy}
              />
            </div>
            <div className={styles.hourField}>
              <label className={styles.label} htmlFor="onb-close">
                İşyeri kapanış saati
              </label>
              <input
                id="onb-close"
                name="closing_time"
                className={styles.input}
                type="time"
                step={300}
                required
                value={closingTime}
                onChange={(ev) => setClosingTime(ev.target.value)}
                disabled={busy}
              />
            </div>
          </div>

          {!oauth ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="onb-pass">
                Şifreniz (doğrulama)
              </label>
              <input
                id="onb-pass"
                name="password"
                className={styles.input}
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                disabled={busy}
              />
            </div>
          ) : null}

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={busy}>
            {busy ? 'Kaydediliyor…' : 'Devam et'}
          </Button>
        </form>

        <p className={styles.hint}>
          Örnek müşteri bağlantısı:{' '}
          <code className={styles.mono}>/menu?isletme=kisa-adresiniz</code>
        </p>

        <p className={styles.switchRow}>
          <button
            type="button"
            className={styles.link}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
            onClick={() => void logout().then(() => navigate('/login', { replace: true }))}
          >
            Çıkış yap
          </button>
        </p>
      </div>
    </div>
  )
}
