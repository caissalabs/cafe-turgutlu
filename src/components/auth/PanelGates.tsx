import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

/** Yalnızca panel oturumu (işletme kimliği) */
export function RequirePanelAuth() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <Outlet />
}

/** Onboarding tamamlanmamış kullanıcılar */
export function OnboardingGate() {
  const { onboardingComplete, active, isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (onboardingComplete && !active) {
    return <Navigate to="/beklemede" replace />
  }
  if (onboardingComplete && active) {
    return <Navigate to="/home" replace />
  }
  return <Outlet />
}

/** Onay bekleyen kullanıcılar */
export function PendingGate() {
  const { onboardingComplete, active, isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (!onboardingComplete) {
    return <Navigate to="/onboarding" replace />
  }
  if (active) {
    return <Navigate to="/home" replace />
  }
  return <Outlet />
}

/** Tam panel (onaylı işletme) */
export function FullPanelGate() {
  const { onboardingComplete, active, isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (!onboardingComplete) {
    return <Navigate to="/onboarding" replace />
  }
  if (!active) {
    return <Navigate to="/beklemede" replace />
  }
  return <Outlet />
}
