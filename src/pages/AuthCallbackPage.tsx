import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import type { Session } from '@supabase/supabase-js'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import styles from './LoginPage.module.css'

function isGoogleAuthSession(session: Session): boolean {
  const meta = session.user.app_metadata?.provider
  if (meta === 'google') return true
  return Boolean(session.user.identities?.some((i) => i.provider === 'google'))
}

export function AuthCallbackPage() {
  useDocumentTitle('CafeNET — Giriş')
  const navigate = useNavigate()
  const { syncOAuthPanelSession } = useAuth()
  const [message, setMessage] = useState('Oturum tamamlanıyor…')

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

      const google = isGoogleAuthSession(session)

      if (google) {
        setMessage('Google hesabınız bağlanıyor…')
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
        return
      }

      setMessage('E-posta ile kaydınız bağlanıyor…')
      const { error: linkErr } = await supabase.rpc('link_password_panel_to_auth_by_email')

      if (cancelled) return

      if (linkErr) {
        console.error(linkErr)
        setMessage(
          'Kayıtlı bir işletme bulunamadı. Yalnızca sitedeki kayıt formu ile oluşturulan hesaplar burada bağlanır.',
        )
        navigate('/login', { replace: true })
        return
      }

      await syncOAuthPanelSession()
      navigate('/', { replace: true })
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [navigate, syncOAuthPanelSession])

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Yönlendiriliyorsunuz</h1>
        <p className={styles.subtitle}>{message}</p>
      </div>
    </div>
  )
}
