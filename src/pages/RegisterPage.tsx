import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import styles from './LoginPage.module.css'

export function RegisterPage() {
  useDocumentTitle('CafeNET — Kayıt')
  const {
    isAuthenticated,
    register,
    signInWithGoogle,
    onboardingComplete,
    active,
  } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return
    if (!onboardingComplete) navigate('/onboarding', { replace: true })
    else if (!active) navigate('/beklemede', { replace: true })
    else navigate('/', { replace: true })
  }, [isAuthenticated, onboardingComplete, active, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor.')
      return
    }

    setBusy(true)
    try {
      const result = await register({
        username,
        password,
      })
      if (result.ok) {
        setPassword('')
        setConfirmPassword('')
        navigate('/', { replace: true })
      } else {
        setError(result.error ?? 'Kayıt başarısız.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Kayıt ol</h1>
        <p className={styles.subtitle}>
          Önce hesap oluşturun; işletme bilgilerini bir sonraki adımda gireceksiniz.
        </p>

        <Button
          type="button"
          variant="secondary"
          className={styles.fullWidth}
          disabled={busy}
          onClick={async () => {
            setError(null)
            setBusy(true)
            try {
              const result = await signInWithGoogle()
              if (!result.ok) setError(result.error ?? 'Google ile kayıt başlatılamadı.')
            } finally {
              setBusy(false)
            }
          }}
        >
          <span className={styles.googleButtonInner}>
            <svg className={styles.googleIcon} width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path
                fill="#FFC107"
                d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
              />
              <path
                fill="#FF3D00"
                d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
              />
            </svg>
            Google ile kayıt ol
          </span>
        </Button>

        <div className={styles.divider} role="separator">
          veya kullanıcı adı ile
        </div>

        <form className={styles.form} onSubmit={handleSubmit} autoComplete="on">
          <div className={styles.field}>
            <label className={styles.label} htmlFor="reg-user">
              Kullanıcı adı
            </label>
            <input
              id="reg-user"
              name="username"
              className={styles.input}
              type="text"
              autoComplete="username"
              required
              maxLength={128}
              value={username}
              onChange={(ev) => setUsername(ev.target.value)}
              disabled={busy}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="reg-pass">
              Şifre
            </label>
            <input
              id="reg-pass"
              name="password"
              className={styles.input}
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={256}
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              disabled={busy}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="reg-pass2">
              Şifre (tekrar)
            </label>
            <input
              id="reg-pass2"
              name="confirm_password"
              className={styles.input}
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={256}
              value={confirmPassword}
              onChange={(ev) => setConfirmPassword(ev.target.value)}
              disabled={busy}
            />
          </div>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={busy}>
            {busy ? 'Kaydediliyor…' : 'Hesap oluştur'}
          </Button>
        </form>

        <p className={styles.switchRow}>
          Zaten hesabınız var mı?{' '}
          <Link className={styles.link} to="/login">
            Giriş yapın
          </Link>
        </p>
      </div>
    </div>
  )
}
