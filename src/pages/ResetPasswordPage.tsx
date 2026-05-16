import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { supabase } from '@/lib/supabaseClient'
import styles from './LoginPage.module.css'

export function ResetPasswordPage() {
  useDocumentTitle('CafeNET — Yeni şifre')
  const { completePasswordRecovery } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        setSessionReady(Boolean(session))
      }
    })
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      setSessionReady(Boolean(session))
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Şifreler eşleşmiyor.')
      return
    }
    setBusy(true)
    try {
      const result = await completePasswordRecovery(password)
      if (result.ok) {
        setPassword('')
        setConfirm('')
        navigate('/', { replace: true })
      } else {
        setError(result.error ?? 'Şifre güncellenemedi.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Yeni şifre belirle</h1>
        <p className={styles.subtitle}>
          E-postadaki bağlantıyla geldiyseniz aşağıdan yeni şifrenizi kaydedin.
        </p>

        {!sessionReady ? (
          <p className={styles.error} role="alert">
            Oturum bulunamadı. Lütfen e-postadaki bağlantıyı tekrar kullanın veya yeni talep oluşturun.
          </p>
        ) : (
          <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="reset-pass">
                Yeni şifre
              </label>
              <input
                id="reset-pass"
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
              <label className={styles.label} htmlFor="reset-pass2">
                Yeni şifre (tekrar)
              </label>
              <input
                id="reset-pass2"
                name="confirm_password"
                className={styles.input}
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={256}
                value={confirm}
                onChange={(ev) => setConfirm(ev.target.value)}
                disabled={busy}
              />
            </div>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={busy}>
              {busy ? 'Kaydediliyor…' : 'Şifreyi kaydet'}
            </Button>
          </form>
        )}

        <p className={styles.switchRow}>
          <Link className={styles.link} to="/login">
            Giriş sayfası
          </Link>
        </p>
      </div>
    </div>
  )
}
