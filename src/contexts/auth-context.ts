import { createContext } from 'react'

export type AuthContextValue = {
  isAuthenticated: boolean
  /** Oturum açık işletme (Supabase satır kimliği) */
  businessId: string | null
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
