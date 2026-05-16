import { createContext } from 'react'

export type RegisterInput = {
  businessName: string
  slug: string
  username: string
  password: string
}

export type RegisterGoogleBusinessInput = {
  businessName: string
  slug: string
}

export type AuthContextValue = {
  isAuthenticated: boolean
  /** Oturum açık işletme (Supabase satır kimliği) */
  businessId: string | null
  login: (
    slug: string,
    username: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>
  register: (input: RegisterInput) => Promise<{ ok: boolean; error?: string }>
  /** Google ile panel oturumu (işletme seçimi callback'te tamamlanır) */
  signInWithGoogle: () => Promise<{ ok: boolean; error?: string }>
  /** Google oturumu varken işletme oluşturma */
  registerBusinessWithGoogle: (
    input: RegisterGoogleBusinessInput,
  ) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
