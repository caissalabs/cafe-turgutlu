import type { ReactNode } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
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

const NAV_ITEMS = [
  { to: '/home', end: true, label: 'Masalar', icon: 'table_restaurant' },
  { to: '/home/odeme-gecmisi', label: 'Ödeme Geçmişi', icon: 'receipt_long' },
  { to: '/home/menu', label: 'Menü', icon: 'restaurant_menu' },
  { to: '/home/menu/onizleme', label: 'Önizleme', icon: 'visibility' },
  { to: '/home/qr-kodlari', label: 'QR kodlarım', icon: 'qr_code_2' },
] as const

function panelAvatarLetters(username: string | null): string {
  const u = username?.trim()
  if (!u) return '?'
  if (u.length <= 2) return u.toUpperCase()
  return u.slice(0, 2).toUpperCase()
}

function ProfileMenu() {
  const { logout, panelUsername } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const onAccount = Boolean(useMatch({ path: '/home/hesabim', end: true }))
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    function onPointerDown(ev: PointerEvent) {
      if (!wrapRef.current?.contains(ev.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const name = panelUsername?.trim() || 'Hesap'
  const initials = panelAvatarLetters(panelUsername)

  return (
    <div className={styles.profileWrap} ref={wrapRef}>
      <button
        type="button"
        className={cn(styles.profileTrigger, onAccount && styles.profileTriggerActive)}
        aria-label="Hesap menüsü"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        id="header-profile-menu-button"
        onClick={() => setOpen((v) => !v)}
      >
        <div className={styles.profileTextCol}>
          <span className={styles.profileUsername}>{name}</span>
          <span className={styles.profileLive}>
            <span className={styles.profileLiveDot} aria-hidden />
            Sistem Aktif
          </span>
        </div>
        <span className={styles.avatar} aria-hidden>
          {initials}
        </span>
        <span
          className={cn('material-symbols-outlined', styles.profileExpandIcon)}
          aria-hidden
        >
          expand_more
        </span>
      </button>

      {open ? (
        <div
          className={styles.profileDropdown}
          id={menuId}
          role="menu"
          aria-labelledby="header-profile-menu-button"
        >
          <NavLink
            to="/home/hesabim"
            role="menuitem"
            className={({ isActive }) =>
              cn(styles.profileMenuItem, isActive && styles.profileMenuItemActive)
            }
            onClick={() => setOpen(false)}
          >
            <span className={cn('material-symbols-outlined', styles.profileMenuIcon)} aria-hidden>
              person
            </span>
            Hesabım
          </NavLink>
          <hr className={styles.dropdownDivider} aria-hidden />
          <button
            type="button"
            role="menuitem"
            className={cn(styles.profileMenuItem, styles.profileMenuItemLogout)}
            onClick={() => {
              setOpen(false)
              void logout().then(() => navigate('/login', { replace: true }))
            }}
          >
            <span className={cn('material-symbols-outlined', styles.profileMenuIcon)} aria-hidden>
              logout
            </span>
            Çıkış yap
          </button>
        </div>
      ) : null}
    </div>
  )
}

function LayoutChrome({ children }: { children?: ReactNode }) {
  const navigate = useNavigate()
  const away = useMasalarAwayAlert()
  const mobileNavId = useId()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileNavOpen) return
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [mobileNavOpen])

  useEffect(() => {
    if (!mobileNavOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileNavOpen])

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
          <div className={styles.headerStart}>
            <NavLink to="/home" className={styles.brand}>
              <span className={styles.brandName}>CafeNET</span>
              <span className={styles.brandTag}>Yönetici Paneli</span>
            </NavLink>
          </div>
          <nav className={styles.desktopNav} aria-label="Yönetici Paneli">
            {NAV_ITEMS.map((item) => {
              if (item.to === '/home') {
                return (
                  <span key={item.to} className={styles.navItemBadgeWrap}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      aria-label={away.masalarBadge ? 'Masalar — yeni sipariş var' : undefined}
                      className={({ isActive }) =>
                        cn(styles.navLink, isActive && styles.navLinkActive)
                      }
                    >
                      <span className={cn('material-symbols-outlined', styles.navIcon)} aria-hidden>
                        {item.icon}
                      </span>
                      {item.label}
                    </NavLink>
                    {away.masalarBadge ? (
                      <span className={styles.navNewDot} title="Yeni sipariş" aria-hidden />
                    ) : null}
                  </span>
                )
              }
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => cn(styles.navLink, isActive && styles.navLinkActive)}
                >
                  <span className={cn('material-symbols-outlined', styles.navIcon)} aria-hidden>
                    {item.icon}
                  </span>
                  {item.label}
                </NavLink>
              )
            })}
          </nav>

          <div className={styles.headerEnd}>
            <ProfileMenu />
            <button
              type="button"
              className={styles.mobileToggle}
              aria-label={mobileNavOpen ? 'Menüyü kapat' : 'Menüyü aç'}
              aria-expanded={mobileNavOpen}
              aria-controls={mobileNavId}
              onClick={() => setMobileNavOpen((x) => !x)}
            >
              <span className={cn('material-symbols-outlined', styles.mobileToggleIcon)} aria-hidden>
                {mobileNavOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {mobileNavOpen ? (
          <button
            type="button"
            className={styles.mobileNavBackdrop}
            aria-label="Menüyü kapat"
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}
        <div id={mobileNavId} className={cn(styles.mobileNav, mobileNavOpen && styles.mobileNavOpen)}>
          <nav aria-label="Yönetici Paneli mobil">
            {NAV_ITEMS.map((item) => {
              const link = (
                <>
                  <span className={cn('material-symbols-outlined', styles.mobileNavIcon)} aria-hidden>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </>
              )
              if (item.to === '/home') {
                return (
                  <span key={item.to} className={styles.mobileNavRow}>
                    <NavLink to={item.to} end={item.end} className={styles.mobileNavLink}>
                      {link}
                    </NavLink>
                    {away.masalarBadge ? (
                      <span className={styles.mobileNavBadge} aria-hidden />
                    ) : null}
                  </span>
                )
              }
              return (
                <NavLink key={item.to} to={item.to} className={styles.mobileNavLink}>
                  {link}
                </NavLink>
              )
            })}
          </nav>
        </div>
      </header>

      <main
        className={cn(
          styles.main,
          location.pathname === '/home' && styles.mainMasalarHome,
        )}
      >
        {children ?? <Outlet />}
      </main>

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
