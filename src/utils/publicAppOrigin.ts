/** Panel ve QR linkleri için kamuya açık uygulama kökü (üretimde VITE_SITE_URL kullanın). */
export function getPublicAppOrigin(): string {
  const env = import.meta.env.VITE_SITE_URL?.trim()
  if (env) return env.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '')
  return ''
}

/** Müşteri menüsü URL’si — QR içeriği (business UUID + masa). */
export function buildTableMenuQrUrl(businessId: string, tableId: number): string {
  const origin = getPublicAppOrigin()
  const u = new URL(`${origin}/menu`)
  u.searchParams.set('business', businessId)
  u.searchParams.set('masa', String(tableId))
  return u.toString()
}
