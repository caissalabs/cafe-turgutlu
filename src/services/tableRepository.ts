import { supabase } from '@/lib/supabaseClient'
import { CAFE_TABLES, MAX_TABLE_ID } from '@/constants/tables'

export type TableRow = {
  id: number
  name: string
}

const LOCAL_KEY = 'cafe-turgutlu-table-names-v1'

function readLocalNames(): Map<number, string> {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as Record<string, string>
    return new Map(Object.entries(parsed).map(([k, v]) => [Number(k), v]))
  } catch {
    return new Map()
  }
}

function writeLocalNames(names: Map<number, string>) {
  const obj: Record<string, string> = {}
  for (const [k, v] of names) obj[String(k)] = v
  localStorage.setItem(LOCAL_KEY, JSON.stringify(obj))
}

function sortRows(rows: TableRow[]): TableRow[] {
  return [...rows].sort((a, b) => a.id - b.id)
}

export async function fetchTableNames(): Promise<TableRow[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('cafe_tables')
      .select('id, name')
      .order('id', { ascending: true })
    if (error) throw error
    return sortRows((data ?? []) as TableRow[])
  }
  const local = readLocalNames()
  if (local.size === 0) {
    for (const t of CAFE_TABLES) local.set(t.id, t.name)
    writeLocalNames(local)
  }
  return sortRows(Array.from(local.entries()).map(([id, name]) => ({ id, name })))
}

export async function upsertTableName(tableId: number, name: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('cafe_tables')
      .update({ name })
      .eq('id', tableId)
    if (error) throw error
    return
  }
  const local = readLocalNames()
  local.set(tableId, name)
  writeLocalNames(local)
}

export async function insertTableRow(tableId: number, name: string): Promise<void> {
  if (tableId < 1 || tableId > MAX_TABLE_ID) {
    throw new Error(`Masa numarası 1–${MAX_TABLE_ID} arasında olmalıdır.`)
  }
  if (supabase) {
    const { error } = await supabase.from('cafe_tables').insert({ id: tableId, name })
    if (error) throw error
    return
  }
  const local = readLocalNames()
  if (local.has(tableId)) {
    throw new Error('Bu masa zaten var.')
  }
  local.set(tableId, name)
  writeLocalNames(local)
}
