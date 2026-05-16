import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  FullPanelGate,
  OnboardingGate,
  PendingGate,
  RequirePanelAuth,
} from '@/components/auth/PanelGates'
import { Layout } from '@/components/Layout'
import { AuthProvider } from '@/contexts/AuthProvider'
import { useAuth } from '@/hooks/useAuth'
import { MenuEditorPage } from '@/pages/MenuEditorPage'
import { AdminHomePage } from '@/pages/AdminHomePage'
import { PaymentHistoryPage } from '@/pages/PaymentHistoryPage'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'
import { LoginPage } from '@/pages/LoginPage'
import { MenuPage } from '@/pages/MenuPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { OrderSuccessPage } from '@/pages/OrderSuccessPage'
import { PendingApprovalPage } from '@/pages/PendingApprovalPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { QrCodesPage } from '@/pages/QrCodesPage'
import { AccountPage } from '@/pages/AccountPage'

function PostAuthNavigate() {
  const { isAuthenticated, onboardingComplete, active } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!onboardingComplete) return <Navigate to="/onboarding" replace />
  if (!active) return <Navigate to="/beklemede" replace />
  return <Navigate to="/home" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/sifremi-unuttum" element={<ForgotPasswordPage />} />
          <Route path="/auth/sifre-yenile" element={<ResetPasswordPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          <Route element={<RequirePanelAuth />}>
            <Route element={<OnboardingGate />}>
              <Route path="/onboarding" element={<OnboardingPage />} />
            </Route>
          </Route>

          <Route element={<RequirePanelAuth />}>
            <Route element={<PendingGate />}>
              <Route path="/beklemede" element={<PendingApprovalPage />} />
            </Route>
          </Route>

          <Route element={<FullPanelGate />}>
            <Route path="/home" element={<Layout />}>
              <Route index element={<AdminHomePage />} />
              <Route path="odeme-gecmisi" element={<PaymentHistoryPage />} />
              <Route path="menu" element={<MenuEditorPage />} />
              <Route path="menu/onizleme" element={<MenuPage variant="staff" />} />
              <Route path="qr-kodlari" element={<QrCodesPage />} />
              <Route path="hesabim" element={<AccountPage />} />
            </Route>
          </Route>

          <Route path="/menu/tamamlandi" element={<OrderSuccessPage />} />
          <Route path="/menu" element={<MenuPage />} />

          <Route path="/" element={<PostAuthNavigate />} />
          <Route path="*" element={<PostAuthNavigate />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
