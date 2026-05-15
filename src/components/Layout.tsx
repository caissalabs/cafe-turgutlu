import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { unlockCashRegisterAudio } from '@/utils/cashRegisterSound'
import { unlockNewOrderNotificationAudio } from '@/utils/orderAlarmSound'
import { cn } from '@/utils/cn'
import styles from './Layout.module.css'

type LayoutProps = {
  children?: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { logout } = useAuth()
  const navigate = useNavigate()

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
      <header className={styles.header}>
        <div className={styles.inner}>
          <NavLink to="/home" className={styles.brand}>
            <span className={styles.brandName}>CafeNET</span>
            <span className={styles.brandTag}>Yönetici Paneli</span>
          </NavLink>
          <nav className={styles.nav} aria-label="Yönetici Paneli">
            <NavLink
              to="/home"
              end
              className={({ isActive }) =>
                cn(styles.navItem, isActive && styles.navItemActive)
              }
            >
              Masalar
            </NavLink>
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
            <button
              type="button"
              className={styles.logout}
              onClick={() => {
                logout()
                navigate('/login', { replace: true })
              }}
            >
              Çıkış
            </button>
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
