import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import styles from './LoginPage.module.css'

type LocationState = { from?: { pathname?: string } }

export function LoginPage() {
  useDocumentTitle('CafeNET — Yönetici girişi')
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as LocationState | null)?.from?.pathname ?? '/home'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from === '/login' ? '/home' : from, { replace: true })
    }
  }, [from, isAuthenticated, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const result = await login(username.trim(), password)
      if (result.ok) {
        setPassword('')
        navigate(from === '/login' ? '/home' : from, { replace: true })
      } else {
        setError(result.error ?? 'Giriş başarısız.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Yönetici girişi</h1>
        <p className={styles.subtitle}>CafeNET paneline erişim</p>

        <form
          className={styles.form}
          onSubmit={handleSubmit}
          autoComplete="on"
          method="post"
        >
          <div className={styles.field}>
            <label className={styles.label} htmlFor="admin-user">
              Kullanıcı adı
            </label>
            <input
              id="admin-user"
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
            <label className={styles.label} htmlFor="admin-pass">
              Şifre
            </label>
            <input
              id="admin-pass"
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

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={busy}>
            {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </Button>
        </form>

        <p className={styles.hint}>
          Güvenlik: üretim ortamında girişi mutlaka HTTPS ve sunucu tarafı oturum
          ile destekleyin; tarayıcıdaki yapılandırma tek başına yeterli değildir.
        </p>
      </div>
    </div>
  )
}
