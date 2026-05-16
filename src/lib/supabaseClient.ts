import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

if (!url || !anonKey) {
  throw new Error(
    'Supabase yapılandırması eksik: .env.local içinde VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlı olmalı.',
  )
}

export const supabase: SupabaseClient = createClient(url, anonKey)
