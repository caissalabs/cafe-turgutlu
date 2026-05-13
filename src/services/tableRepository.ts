import { supabase } from '@/lib/supabaseClient'
import { CAFE_TABLES, MAX_TABLE_ID, canonicalTableName } from '@/constants/tables'

export type TableRow = {
  id: number
  name: string
  nickname: string | null
}

const OLD_NAMES_KEY = 'cafe-turgutlu-table-names-v1'
const LOCAL_STATE_KEY = 'cafe-turgutlu-tables-v2'

type LocalPersist = {
  ids: number[]
  nicknames: Record<string, string>
}

function readLocalPersist(): LocalPersist | null {
  try {
    const raw = localStorage.getItem(LOCAL_STATE_KEY)
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
    return { ids: (p as LocalPersist).ids.map(Number).filter((n) => Number.isFinite(n)), nicknames }
  } catch {
    return null
  }
}

function writeLocalPersist(state: LocalPersist) {
  const ids = [...new Set(state.ids)].sort((a, b) => a - b)
  const nicknames = { ...state.nicknames }
  for (const k of Object.keys(nicknames)) {
    if (!nicknames[k]?.trim()) delete nicknames[k]
  }
  localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify({ ids, nicknames }))
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
    return { ids, nicknames }
  } catch {
    return null
  }
}

function ensureLocalPersist(): LocalPersist {
  let p = readLocalPersist()
  if (!p) {
    p = migrateFromOldNamesMap()
  }
  if (!p || p.ids.length === 0) {
    p = {
      ids: CAFE_TABLES.map((t) => t.id),
      nicknames: {},
    }
  }
  writeLocalPersist(p)
  return p
}

function sortRows(rows: TableRow[]): TableRow[] {
  return [...rows].sort((a, b) => a.id - b.id)
}

function rowFromLocalId(id: number, nicknames: Record<string, string>): TableRow {
  const nick = nicknames[String(id)]?.trim() || null
  return {
    id,
    name: canonicalTableName(id),
    nickname: nick,
  }
}

export async function fetchTableNames(): Promise<TableRow[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('cafe_tables')
      .select('id, name, nickname')
      .order('id', { ascending: true })
    if (error) throw error
    const rows = (data ?? []) as { id: number; name: string; nickname: string | null }[]
    return sortRows(
      rows.map((r) => ({
        id: r.id,
        name: canonicalTableName(r.id),
        nickname: r.nickname?.trim() || null,
      })),
    )
  }

  const p = ensureLocalPersist()
  return sortRows(p.ids.map((id) => rowFromLocalId(id, p.nicknames)))
}

export async function upsertTableNickname(tableId: number, nickname: string | null): Promise<void> {
  const trimmed = nickname?.trim() || null
  if (supabase) {
    const { error } = await supabase
      .from('cafe_tables')
      .update({ nickname: trimmed })
      .eq('id', tableId)
    if (error) throw error
    return
  }
  const p = ensureLocalPersist()
  if (!p.ids.includes(tableId)) return
  if (trimmed) p.nicknames[String(tableId)] = trimmed
  else delete p.nicknames[String(tableId)]
  writeLocalPersist(p)
}

export async function insertTableRow(tableId: number): Promise<void> {
  if (tableId < 1 || tableId > MAX_TABLE_ID) {
    throw new Error(`Masa numarası 1–${MAX_TABLE_ID} arasında olmalıdır.`)
  }
  const name = canonicalTableName(tableId)
  if (supabase) {
    const { error } = await supabase
      .from('cafe_tables')
      .insert({ id: tableId, name, nickname: null })
    if (error) throw error
    return
  }
  const p = ensureLocalPersist()
  if (p.ids.includes(tableId)) {
    throw new Error('Bu masa zaten var.')
  }
  p.ids.push(tableId)
  writeLocalPersist(p)
}

export async function deleteTableRow(tableId: number): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('cafe_tables').delete().eq('id', tableId)
    if (error) throw error
    return
  }
  const p = ensureLocalPersist()
  p.ids = p.ids.filter((id) => id !== tableId)
  delete p.nicknames[String(tableId)]
  writeLocalPersist(p)
}
