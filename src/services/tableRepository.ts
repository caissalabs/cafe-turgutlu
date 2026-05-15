import { supabase } from '@/lib/supabaseClient'
import { CAFE_TABLES, MAX_TABLE_ID, canonicalTableName } from '@/constants/tables'

export type TableRow = {
  id: number
  name: string
  nickname: string | null
  lastOrderAttentionClearedAt: string | null
}

const OLD_NAMES_KEY = 'cafe-turgutlu-table-names-v1'

function localStateKey(businessId: string): string {
  return `cafe-turgutlu-tables::${businessId}`
}

type LocalPersist = {
  ids: number[]
  nicknames: Record<string, string>
  attentionClearedAt?: Record<string, string>
}

function readLocalPersist(businessId: string): LocalPersist | null {
  try {
    const raw = localStorage.getItem(localStateKey(businessId))
    if (!raw) return null
    const p = JSON.parse(raw) as unknown
    if (
      typeof p !== 'object' ||
      p === null ||
      !('ids' in p) ||
      !Array.isArray((p as LocalPersist).ids)
    )
      return null
    const nicknames =
      'nicknames' in p &&
      typeof (p as LocalPersist).nicknames === 'object' &&
      (p as LocalPersist).nicknames !== null
        ? (p as LocalPersist).nicknames
        : {}
    const attentionRaw =
      'attentionClearedAt' in p &&
      typeof (p as LocalPersist).attentionClearedAt === 'object' &&
      (p as LocalPersist).attentionClearedAt !== null
        ? (p as LocalPersist).attentionClearedAt
        : {}
    return {
      ids: (p as LocalPersist).ids.map(Number).filter((n) => Number.isFinite(n)),
      nicknames,
      attentionClearedAt: attentionRaw,
    }
  } catch {
    return null
  }
}

function writeLocalPersist(businessId: string, state: LocalPersist) {
  const ids = [...new Set(state.ids)].sort((a, b) => a - b)
  const nicknames = { ...state.nicknames }
  for (const k of Object.keys(nicknames)) {
    if (!nicknames[k]?.trim()) delete nicknames[k]
  }
  const attentionClearedAt = { ...(state.attentionClearedAt ?? {}) }
  for (const k of Object.keys(attentionClearedAt)) {
    if (!attentionClearedAt[k]?.trim()) delete attentionClearedAt[k]
  }
  localStorage.setItem(
    localStateKey(businessId),
    JSON.stringify({ ids, nicknames, attentionClearedAt }),
  )
}

function migrateFromOldNamesMap(): LocalPersist | null {
  try {
    const raw = localStorage.getItem(OLD_NAMES_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, string>
    const ids = Object.keys(parsed)
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
    if (ids.length === 0) return null
    const nicknames: Record<string, string> = {}
    for (const id of ids) {
      const v = (parsed[String(id)] ?? '').trim()
      if (v && v !== canonicalTableName(id)) nicknames[String(id)] = v
    }
    return { ids, nicknames, attentionClearedAt: {} }
  } catch {
    return null
  }
}

function ensureLocalPersist(businessId: string): LocalPersist {
  let p = readLocalPersist(businessId)
  if (!p) {
    p = migrateFromOldNamesMap()
  }
  if (!p || p.ids.length === 0) {
    p = {
      ids: CAFE_TABLES.map((t) => t.id),
      nicknames: {},
      attentionClearedAt: {},
    }
  }
  if (!p.attentionClearedAt) p.attentionClearedAt = {}
  writeLocalPersist(businessId, p)
  return p
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

function rowFromLocalId(id: number, p: LocalPersist): TableRow {
  const nick = p.nicknames[String(id)]?.trim() || null
  const clearedRaw = p.attentionClearedAt?.[String(id)]?.trim()
  return {
    id,
    name: canonicalTableName(id),
    nickname: nick,
    lastOrderAttentionClearedAt: normalizeClearedAt(clearedRaw ?? null),
  }
}

export async function fetchTableNames(businessId: string): Promise<TableRow[]> {
  if (supabase) {
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

  const p = ensureLocalPersist(businessId)
  return sortRows(p.ids.map((id) => rowFromLocalId(id, p)))
}

export async function recordOrderAttentionCleared(
  businessId: string,
  tableId: number,
): Promise<void> {
  const at = new Date().toISOString()
  if (supabase) {
    const { error } = await supabase
      .from('cafe_tables')
      .update({ last_order_attention_cleared_at: at })
      .eq('business_id', businessId)
      .eq('id', tableId)
    if (error) throw error
    return
  }
  const p = ensureLocalPersist(businessId)
  if (!p.ids.includes(tableId)) return
  if (!p.attentionClearedAt) p.attentionClearedAt = {}
  p.attentionClearedAt[String(tableId)] = at
  writeLocalPersist(businessId, p)
}

export async function upsertTableNickname(
  businessId: string,
  tableId: number,
  nickname: string | null,
): Promise<void> {
  const trimmed = nickname?.trim() || null
  if (supabase) {
    const { error } = await supabase
      .from('cafe_tables')
      .update({ nickname: trimmed })
      .eq('business_id', businessId)
      .eq('id', tableId)
    if (error) throw error
    return
  }
  const p = ensureLocalPersist(businessId)
  if (!p.ids.includes(tableId)) return
  if (trimmed) p.nicknames[String(tableId)] = trimmed
  else delete p.nicknames[String(tableId)]
  writeLocalPersist(businessId, p)
}

export async function insertTableRow(businessId: string, tableId: number): Promise<void> {
  if (tableId < 1 || tableId > MAX_TABLE_ID) {
    throw new Error(`Masa numarası 1–${MAX_TABLE_ID} arasında olmalıdır.`)
  }
  const name = canonicalTableName(tableId)
  if (supabase) {
    const { error } = await supabase.from('cafe_tables').insert({
      business_id: businessId,
      id: tableId,
      name,
      nickname: null,
      last_order_attention_cleared_at: null,
    })
    if (error) throw error
    return
  }
  const p = ensureLocalPersist(businessId)
  if (p.ids.includes(tableId)) {
    throw new Error('Bu masa zaten var.')
  }
  p.ids.push(tableId)
  writeLocalPersist(businessId, p)
}

export async function deleteTableRow(businessId: string, tableId: number): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('cafe_tables')
      .delete()
      .eq('business_id', businessId)
      .eq('id', tableId)
    if (error) throw error
    return
  }
  const p = ensureLocalPersist(businessId)
  p.ids = p.ids.filter((id) => id !== tableId)
  delete p.nicknames[String(tableId)]
  if (p.attentionClearedAt) delete p.attentionClearedAt[String(tableId)]
  writeLocalPersist(businessId, p)
}
