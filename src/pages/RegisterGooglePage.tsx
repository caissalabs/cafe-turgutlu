import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { supabase } from '@/lib/supabaseClient'
import styles from './LoginPage.module.css'

export function RegisterGooglePage() {
  useDocumentTitle('CafeNET — Google ile işletme kaydı')
  const { isAuthenticated, registerBusinessWithGoogle } = useAuth()
  const navigate = useNavigate()

  const [businessName, setBusinessName] = useState('')
  const [slug, setSlug] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [gateChecked, setGateChecked] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/home', { replace: true })
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    let cancelled = false

    async function gate() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (cancelled) return

      if (!session?.user) {
        navigate('/login', { replace: true })
        return
      }

      const { data: bid } = await supabase.rpc('get_business_id_for_auth_user')

      if (cancelled) return

      if (typeof bid === 'string') {
        navigate('/home', { replace: true })
        return
      }

      setGateChecked(true)
    }

    void gate()

    return () => {
      cancelled = true
    }
  }, [navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const result = await registerBusinessWithGoogle({ businessName, slug })
      if (result.ok) {
        navigate('/home', { replace: true })
      } else {
        setError(result.error ?? 'Kayıt başarısız.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (!gateChecked) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>İşletme kaydı</h1>
          <p className={styles.subtitle}>Yükleniyor…</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>İşletmenizi oluşturun</h1>
        <p className={styles.subtitle}>
          Google hesabınız doğrulandı. İşletme adı ve menü bağlantısı için kullanılacak kısa adresi girin.
        </p>

        <form className={styles.form} onSubmit={handleSubmit} autoComplete="on">
          <div className={styles.field}>
            <label className={styles.label} htmlFor="g-reg-name">
              İşletme adı
            </label>
            <input
              id="g-reg-name"
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
            <label className={styles.label} htmlFor="g-reg-slug">
              Kısa adres (URL)
            </label>
            <input
              id="g-reg-slug"
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

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={busy}>
            {busy ? 'Kaydediliyor…' : 'İşletmeyi oluştur'}
          </Button>
        </form>

        <p className={styles.switchRow}>
          <Link className={styles.link} to="/login">
            E-posta kullanıcı adı ile giriş
          </Link>
        </p>
      </div>
    </div>
  )
}
