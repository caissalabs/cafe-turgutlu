import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import styles from './LoginPage.module.css'

export function AuthCallbackPage() {
  useDocumentTitle('CafeNET — Giriş')
  const navigate = useNavigate()
  const [message, setMessage] = useState('Hesabınız doğrulanıyor…')

  useEffect(() => {
    let cancelled = false

    async function run() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (cancelled) return

      if (error || !session?.user) {
        setMessage('Oturum açılamadı.')
        navigate('/login', { replace: true })
        return
      }

      const { data: bid, error: rpcErr } = await supabase.rpc('get_business_id_for_auth_user')

      if (cancelled) return

      if (rpcErr) {
        console.error(rpcErr)
        setMessage('İşletme bilgisi alınamadı.')
        navigate('/login', { replace: true })
        return
      }

      if (typeof bid === 'string') {
        navigate('/home', { replace: true })
        return
      }

      navigate('/register/google', { replace: true })
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Google ile giriş</h1>
        <p className={styles.subtitle}>{message}</p>
      </div>
    </div>
  )
}
