import { createContext } from 'react'

export type AuthMethod = 'password' | 'oauth'

export type RegisterInput = {
  username: string
  password: string
}

export type CompleteOnboardingPasswordInput = {
  businessName: string
  managerName: string
  slug: string
  password: string
}

export type CompleteOnboardingGoogleInput = {
  businessName: string
  managerName: string
  slug: string
}

export type AuthContextValue = {
  isAuthenticated: boolean
  businessId: string | null
  /** İşletme profili onboarding tamamlandı */
  onboardingComplete: boolean
  /** Supabase businesses.active — yönetici onayı */
  active: boolean
  /** Şifre hesabı kullanıcı adı veya Google için teknik kullanıcı adı */
  panelUsername: string | null
  authMethod: AuthMethod | null

  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  register: (input: RegisterInput) => Promise<{ ok: boolean; error?: string }>
  completeOnboardingPassword: (
    input: CompleteOnboardingPasswordInput,
  ) => Promise<{ ok: boolean; error?: string }>
  completeOnboardingGoogle: (
    input: CompleteOnboardingGoogleInput,
  ) => Promise<{ ok: boolean; error?: string }>

  signInWithGoogle: () => Promise<{ ok: boolean; error?: string }>
  /** OAuth oturumundan panel bayraklarını yeniden okur */
  syncOAuthPanelSession: () => Promise<void>
  /** Bekleme ekranı: businesses tablosundan active/onboarding_complete günceller */
  refreshActivationFromDb: () => Promise<void>

  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
