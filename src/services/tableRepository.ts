import { supabase } from '@/lib/supabaseClient'
import { MAX_TABLE_ID, canonicalTableName } from '@/constants/tables'

export type TableRow = {
  id: number
  name: string
  nickname: string | null
  lastOrderAttentionClearedAt: string | null
}

function sortRows(rows: TableRow[]): TableRow[] {
  return [...rows].sort((a, b) => a.id - b.id)
}

function normalizeClearedAt(raw: string | null | undefined): string | null {
  const s = raw?.trim()
  if (!s) return null
  const t = new Date(s).getTime()
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

export async function fetchTableNames(businessId: string): Promise<TableRow[]> {
  const { data, error } = await supabase
    .from('cafe_tables')
    .select('id, name, nickname, last_order_attention_cleared_at')
    .eq('business_id', businessId)
    .order('id', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as {
    id: number
    name: string
    nickname: string | null
    last_order_attention_cleared_at: string | null
  }[]
  return sortRows(
    rows.map((r) => ({
      id: r.id,
      name: canonicalTableName(r.id),
      nickname: r.nickname?.trim() || null,
      lastOrderAttentionClearedAt: normalizeClearedAt(r.last_order_attention_cleared_at),
    })),
  )
}

export async function recordOrderAttentionCleared(
  businessId: string,
  tableId: number,
): Promise<void> {
  const at = new Date().toISOString()
  const { error } = await supabase
    .from('cafe_tables')
    .update({ last_order_attention_cleared_at: at })
    .eq('business_id', businessId)
    .eq('id', tableId)
  if (error) throw error
}

export async function upsertTableNickname(
  businessId: string,
  tableId: number,
  nickname: string | null,
): Promise<void> {
  const trimmed = nickname?.trim() || null
  const { error } = await supabase
    .from('cafe_tables')
    .update({ nickname: trimmed })
    .eq('business_id', businessId)
    .eq('id', tableId)
  if (error) throw error
}

export async function insertTableRow(businessId: string, tableId: number): Promise<void> {
  if (tableId < 1 || tableId > MAX_TABLE_ID) {
    throw new Error(`Masa numarası 1–${MAX_TABLE_ID} arasında olmalıdır.`)
  }
  const name = canonicalTableName(tableId)
  const { error } = await supabase.from('cafe_tables').insert({
    business_id: businessId,
    id: tableId,
    name,
    nickname: null,
    last_order_attention_cleared_at: null,
  })
  if (error) throw error
}

export async function deleteTableRow(businessId: string, tableId: number): Promise<void> {
  const { error } = await supabase
    .from('cafe_tables')
    .delete()
    .eq('business_id', businessId)
    .eq('id', tableId)
  if (error) throw error
}
