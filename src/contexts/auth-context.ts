import { createContext } from 'react'

/** Şifre: eski yalnızca-RPC oturumu | oauth: Google | email: Supabase e-posta/şifre oturumu */
export type AuthMethod = 'password' | 'oauth' | 'email'

export type RegisterInput = {
  username: string
  password: string
  email: string
}

export type CompleteOnboardingPasswordInput = {
  businessName: string
  managerName: string
  slug: string
  /** HH:mm — formda dolu gönderilir. */
  openingTime: string
  closingTime: string
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
  /** Şifre hesabı kullanıcı adı veya Google için teknik kullanıcı adı */
  panelUsername: string | null
  authMethod: AuthMethod | null

  login: (identifier: string, password: string) => Promise<{ ok: boolean; error?: string }>
  register: (
    input: RegisterInput,
  ) => Promise<{ ok: boolean; error?: string; needsEmailConfirmation?: boolean }>
  /** Şifre sıfırlama e-postası gönderir (Supabase Auth). */
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>
  /** Kurtarma oturumunda yeni şifre + bcrypt senkronu. */
  completePasswordRecovery: (newPassword: string) => Promise<{ ok: boolean; error?: string }>
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

  /** Şifre: oturum türüne göre güncellenir (e-posta/OAuth ile mevcut şifre gerekmez). */
  changePanelPassword: (input: {
    currentPassword?: string
    newPassword: string
  }) => Promise<{ ok: boolean; error?: string }>

  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
