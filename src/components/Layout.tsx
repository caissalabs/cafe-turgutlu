import type { ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/utils/cn'
import styles from './Layout.module.css'

type LayoutProps = {
  children?: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.inner}>
          <NavLink to="/home" className={styles.brand}>
            Cafe Turgutlu
          </NavLink>
          <nav className={styles.nav} aria-label="Yönetim">
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
              to="/home/qr"
              className={({ isActive }) =>
                cn(styles.navItem, isActive && styles.navItemActive)
              }
            >
              QR kodlar
            </NavLink>
            <NavLink to="/menu" className={styles.menuPublic}>
              Menü
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
          © {new Date().getFullYear()} Cafe Turgutlu — Yönetim
        </p>
      </footer>
    </div>
  )
}
