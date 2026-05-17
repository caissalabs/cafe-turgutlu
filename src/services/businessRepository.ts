import { supabase } from '@/lib/supabaseClient'

/** Müşteri menüsünde işletme adı için anon okuması — RLS: businesses_anon_select */
export async function fetchBusinessPublicName(businessId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('businesses')
    .select('name')
    .eq('id', businessId)
    .single()

  if (error || !data || typeof data.name !== 'string') return null
  const n = data.name.trim()
  return n.length > 0 ? n : null
}
