import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { NewOrderAlertModal } from '@/components/NewOrderAlertModal'
import { OrdersFeedProvider } from '@/contexts/OrdersFeedProvider'
import { useAuth } from '@/hooks/useAuth'
import { useMasalarAwayAlert } from '@/hooks/useMasalarAwayAlert'
import { unlockCashRegisterAudio } from '@/utils/cashRegisterSound'
import { unlockNewOrderNotificationAudio } from '@/utils/orderAlarmSound'
import { cn } from '@/utils/cn'
import styles from './Layout.module.css'

type LayoutProps = {
  children?: ReactNode
}

function panelAvatarLetters(username: string | null): string {
  const u = username?.trim()
  if (!u) return '?'
  if (u.length <= 2) return u.toUpperCase()
  return u.slice(0, 2).toUpperCase()
}

function LayoutChrome({ children }: { children?: ReactNode }) {
  const { logout, panelUsername } = useAuth()
  const navigate = useNavigate()
  const away = useMasalarAwayAlert()

  useEffect(() => {
    const warm = () => {
      unlockCashRegisterAudio()
      unlockNewOrderNotificationAudio()
    }
    document.addEventListener('pointerdown', warm, { capture: true, passive: true })
    document.addEventListener('keydown', warm, { capture: true, passive: true })
    return () => {
      document.removeEventListener('pointerdown', warm, { capture: true })
      document.removeEventListener('keydown', warm, { capture: true })
    }
  }, [])

  return (
    <div className={styles.shell}>
      <NewOrderAlertModal
        open={away.returnModalOpen}
        tableNumbers={away.returnModalTables}
        onDismiss={away.dismissReturnModal}
        hint="Tamam yalnızca bildirimi ve zili kapatır; Masalar’daki kırmızı işaret kalır. İşaret yalnızca Masalara git veya üstteki Masalar ile masalar ekranına geçince kaybolur."
        secondaryLabel="Masalara git"
        onSecondary={() => {
          away.dismissReturnModal()
          navigate('/home')
        }}
      />

      <header className={styles.header}>
        <div className={styles.inner}>
          <NavLink to="/home" className={styles.brand}>
            <span className={styles.brandName}>CafeNET</span>
            <span className={styles.brandTag}>Yönetici Paneli</span>
          </NavLink>
          <nav className={styles.nav} aria-label="Yönetici Paneli">
            <span className={styles.navItemBadgeWrap}>
              <NavLink
                to="/home"
                end
                aria-label={away.masalarBadge ? 'Masalar — yeni sipariş var' : undefined}
                className={({ isActive }) =>
                  cn(styles.navItem, isActive && styles.navItemActive)
                }
              >
                Masalar
              </NavLink>
              {away.masalarBadge ? (
                <span className={styles.navNewDot} title="Yeni sipariş" aria-hidden />
              ) : null}
            </span>
            <NavLink
              to="/home/odeme-gecmisi"
              className={({ isActive }) =>
                cn(styles.navItem, isActive && styles.navItemActive)
              }
            >
              Ödeme geçmişi
            </NavLink>
            <NavLink
              to="/home/menu"
              className={({ isActive }) =>
                cn(styles.navItem, isActive && styles.navItemActive)
              }
            >
              Menü
            </NavLink>
            <NavLink
              to="/home/menu/onizleme"
              className={({ isActive }) =>
                cn(styles.navItem, isActive && styles.navItemActive)
              }
            >
              Önizleme
            </NavLink>
            <NavLink
              to="/home/qr-kodlari"
              className={({ isActive }) =>
                cn(styles.navItem, isActive && styles.navItemActive)
              }
            >
              QR kodlarım
            </NavLink>
            <button
              type="button"
              className={styles.logout}
              onClick={() => {
                void logout().then(() => navigate('/login', { replace: true }))
              }}
            >
              Çıkış
            </button>
            <NavLink
              to="/home/hesabim"
              className={({ isActive }) =>
                cn(styles.profileLink, isActive && styles.profileLinkActive)
              }
              aria-label="Hesabım"
            >
              <span className={styles.avatar} aria-hidden>
                {panelAvatarLetters(panelUsername)}
              </span>
              <span className={styles.profileName}>
                {panelUsername?.trim() || 'Hesap'}
              </span>
            </NavLink>
          </nav>
        </div>
      </header>

      <main className={styles.main}>{children ?? <Outlet />}</main>

      <footer className={styles.footer}>
        <p className={styles.footerLine}>
          © {new Date().getFullYear()} CafeNET — Yönetici Paneli
        </p>
      </footer>
    </div>
  )
}

export function Layout({ children }: LayoutProps) {
  const { businessId } = useAuth()

  return (
    <OrdersFeedProvider businessId={businessId}>
      <LayoutChrome>{children}</LayoutChrome>
    </OrdersFeedProvider>
  )
}
