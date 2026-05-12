import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AuthProvider } from '@/contexts/AuthProvider'
import { useAuth } from '@/hooks/useAuth'
import { AdminHomePage } from '@/pages/AdminHomePage'
import { LoginPage } from '@/pages/LoginPage'
import { MenuPage } from '@/pages/MenuPage'
import { OrderSuccessPage } from '@/pages/OrderSuccessPage'

function RootRedirect() {
  const { isAuthenticated } = useAuth()
  return <Navigate to={isAuthenticated ? '/home' : '/login'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/menu/tamamlandi" element={<OrderSuccessPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/home" element={<Layout />}>
              <Route index element={<AdminHomePage />} />
              <Route path="menu" element={<MenuPage variant="staff" />} />
            </Route>
          </Route>
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
