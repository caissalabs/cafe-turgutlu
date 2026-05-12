import { createContext } from 'react'

export type AuthContextValue = {
  isAuthenticated: boolean
  login: (
    username: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
