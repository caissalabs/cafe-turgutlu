import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CafeTable } from '@/constants/tables'
import { CAFE_TABLES, MAX_TABLE_ID } from '@/constants/tables'
import { fetchTableNames, insertTableRow, upsertTableName } from '@/services/tableRepository'

function sortTables(list: CafeTable[]): CafeTable[] {
  return [...list].sort((a, b) => a.id - b.id)
}

export function useCafeTables() {
  const [tables, setTables] = useState<CafeTable[]>(() => [...CAFE_TABLES])

  const load = useCallback(async () => {
    try {
      const rows = await fetchTableNames()
      if (rows.length > 0) {
        setTables(rows.map((r) => ({ id: r.id, name: r.name })))
      }
    } catch {
      /* varsayılan CAFE_TABLES kalır */
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const names = useMemo(
    () => new Map<number, string>(tables.map((t) => [t.id, t.name] as const)),
    [tables],
  )

  const rename = useCallback(async (tableId: number, name: string) => {
    await upsertTableName(tableId, name)
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, name } : t)))
  }, [])

  const addTable = useCallback(async () => {
    const maxId = tables.reduce((m, t) => Math.max(m, t.id), 0)
    const nextId = maxId + 1
    if (nextId > MAX_TABLE_ID) {
      throw new Error(`En fazla ${MAX_TABLE_ID} masa ekleyebilirsiniz.`)
    }
    const name = `Masa ${nextId}`
    await insertTableRow(nextId, name)
    setTables((prev) => sortTables([...prev, { id: nextId, name }]))
  }, [tables])

  return { tables, names, rename, addTable, refreshTables: load }
}
