/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_USERNAME?: string
  readonly VITE_ADMIN_PASSWORD?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** QR kod sayfasında kullanılır; örn. https://xxx.up.railway.app */
  readonly VITE_PUBLIC_SITE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
