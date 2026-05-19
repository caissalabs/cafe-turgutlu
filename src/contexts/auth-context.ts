import { createContext } from 'react'

/** oauth: Google | email: Supabase e-posta/şifre oturumu */
export type AuthMethod = 'oauth' | 'email'

export type RegisterInput = {
  email: string
  password: string
}

export type CompleteOnboardingGoogleInput = {
  businessName: string
  managerName: string
  slug: string
  openingTime: string
  closingTime: string
}

export type AuthContextValue = {
  isAuthenticated: boolean
  businessId: string | null
  /** İşletme profili onboarding tamamlandı */
  onboardingComplete: boolean
  /** Supabase businesses.active — yönetici onayı */
  active: boolean
  /** Panel e-postası veya dahili hesap etiketi */
  panelUsername: string | null
  authMethod: AuthMethod | null

  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  register: (
    input: RegisterInput,
  ) => Promise<{ ok: boolean; error?: string; needsEmailConfirmation?: boolean }>
  /** Şifre sıfırlama e-postası gönderir (Supabase Auth). */
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>
  /** Kurtarma oturumunda yeni şifre + bcrypt senkronu. */
  completePasswordRecovery: (newPassword: string) => Promise<{ ok: boolean; error?: string }>
  completeOnboarding: (
    input: CompleteOnboardingGoogleInput,
  ) => Promise<{ ok: boolean; error?: string }>

  signInWithGoogle: () => Promise<{ ok: boolean; error?: string }>
  /** OAuth oturumundan panel bayraklarını yeniden okur */
  syncOAuthPanelSession: () => Promise<void>
  /** Bekleme ekranı: businesses tablosundan active/onboarding_complete günceller */
  refreshActivationFromDb: () => Promise<void>

  /** Supabase Auth oturumu üzerinden şifre günceller. */
  changePanelPassword: (input: { newPassword: string }) => Promise<{ ok: boolean; error?: string }>

  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
