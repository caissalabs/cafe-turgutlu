export const ADMIN_SESSION_KEY = 'cafe_turgutlu_admin_v1'
export const ADMIN_SESSION_META_KEY = 'cafe_turgutlu_admin_meta_v2'

/** Oturum süresi (ms). Süre dolunca yeniden giriş gerekir. */
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000

export const ADMIN_LOCKOUT_ATTEMPTS = 5
export const ADMIN_LOCKOUT_MS = 5 * 60 * 1000
