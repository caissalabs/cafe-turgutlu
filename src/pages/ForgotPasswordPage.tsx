import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import styles from './LoginPage.module.css'

export function ForgotPasswordPage() {
  useDocumentTitle('CafeNET — Şifremi unuttum')
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const result = await requestPasswordReset(email)
      if (result.ok) {
        setDone(true)
      } else {
        setError(result.error ?? 'İstek gönderilemedi.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Şifremi unuttum</h1>
        <p className={styles.subtitle}>
          Kayıtlı e-posta adresinize şifre sıfırlama bağlantısı göndeririz. Bağlantı bir süre sonra geçersiz
          olur.
        </p>

        {done ? (
          <>
            <p className={styles.switchRow}>
              Talebiniz alındı. Gelen kutunuzu ve gerekiyorsa spam klasörünü kontrol edin.
            </p>
            <p className={styles.switchRow}>
              <Link className={styles.link} to="/login">
                Girişe dön
              </Link>
            </p>
          </>
        ) : (
          <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="forgot-email">
                E-posta
              </label>
              <input
                id="forgot-email"
                name="email"
                className={styles.input}
                type="email"
                autoComplete="email"
                required
                maxLength={256}
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                disabled={busy}
              />
            </div>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={busy}>
              {busy ? 'Gönderiliyor…' : 'Bağlantı gönder'}
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
