import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import styles from './LoginPage.module.css'

export function AuthCallbackPage() {
  useDocumentTitle('CafeNET — Giriş')
  const navigate = useNavigate()
  const { syncOAuthPanelSession } = useAuth()
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

      const { data: panelRaw, error: panelErr } = await supabase.rpc('get_panel_state_for_auth_user')

      if (cancelled) return

      if (panelErr) {
        console.error(panelErr)
        setMessage('İşletme bilgisi alınamadı.')
        navigate('/login', { replace: true })
        return
      }

      if (
        panelRaw &&
        typeof panelRaw === 'object' &&
        typeof (panelRaw as { business_id?: string }).business_id === 'string'
      ) {
        await syncOAuthPanelSession()
        navigate('/', { replace: true })
        return
      }

      const { error: skelErr } = await supabase.rpc('register_google_skeleton_business')

      if (cancelled) return

      if (skelErr) {
        console.error(skelErr)
        setMessage('İşletme oluşturulamadı.')
        navigate('/login', { replace: true })
        return
      }

      await syncOAuthPanelSession()
      navigate('/onboarding', { replace: true })
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [navigate, syncOAuthPanelSession])

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Google ile giriş</h1>
        <p className={styles.subtitle}>{message}</p>
      </div>
    </div>
  )
}
