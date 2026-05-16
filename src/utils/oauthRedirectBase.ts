/** Panel OAuth ve şifre kurtarma redirect kökü (VITE_SITE_URL veya window.origin). */
export function oauthRedirectBase(): string {
  const env = import.meta.env.VITE_SITE_URL?.trim()
  if (env) return env.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '')
  return ''
}
