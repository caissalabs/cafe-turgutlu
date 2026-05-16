import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import styles from './LoginPage.module.css'

export function PendingApprovalPage() {
  useDocumentTitle('CafeNET — Onay bekleniyor')
  const navigate = useNavigate()
  const { refreshActivationFromDb, active, onboardingComplete, logout, isAuthenticated } = useAuth()

  useEffect(() => {
    void refreshActivationFromDb()
    const t = window.setInterval(() => void refreshActivationFromDb(), 25_000)
    return () => window.clearInterval(t)
  }, [refreshActivationFromDb])

  useEffect(() => {
    if (!isAuthenticated || !onboardingComplete) return
    if (active) {
      navigate('/home', { replace: true })
    }
  }, [active, onboardingComplete, isAuthenticated, navigate])

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Onay bekleniyor</h1>
        <p className={styles.subtitle}>
          İşletmeniz kaydedildi. Yönetici onayından sonra panele tam erişim sağlanacaktır. Bu sayfa birkaç
          saniyede bir güncellenir; onaylandığında otomatik yönlendirilirsiniz.
        </p>

        <Button
          type="button"
          variant="secondary"
          className={styles.fullWidth}
          onClick={() => void refreshActivationFromDb()}
        >
          Durumu yenile
        </Button>

        <p className={styles.switchRow}>
          <button
            type="button"
            className={styles.link}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
            onClick={() => void logout()}
          >
            Çıkış yap
          </button>
          {' · '}
          <Link className={styles.link} to="/login">
            Giriş sayfası
          </Link>
        </p>
      </div>
    </div>
  )
}
