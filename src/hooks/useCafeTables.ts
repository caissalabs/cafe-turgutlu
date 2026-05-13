import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CafeTable } from '@/constants/tables'
import { CAFE_TABLES, MAX_TABLE_ID, canonicalTableName, tableDisplayLabel } from '@/constants/tables'
import { fetchTableNames, insertTableRow, upsertTableNickname, deleteTableRow } from '@/services/tableRepository'

function sortTables(list: CafeTable[]): CafeTable[] {
  return [...list].sort((a, b) => a.id - b.id)
}

export function useCafeTables() {
  const [tables, setTables] = useState<CafeTable[]>(() => [...CAFE_TABLES])

  const load = useCallback(async () => {
    try {
      const rows = await fetchTableNames()
      if (rows.length > 0) {
        setTables(
          rows.map((r) => ({
            id: r.id,
            name: canonicalTableName(r.id),
            nickname: r.nickname,
          })),
        )
      }
    } catch {
      /* varsayılan CAFE_TABLES kalır */
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const names = useMemo(
    () => new Map<number, string>(tables.map((t) => [t.id, tableDisplayLabel(t)] as const)),
    [tables],
  )

  const setNickname = useCallback(async (tableId: number, nickname: string | null) => {
    await upsertTableNickname(tableId, nickname)
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? { ...t, name: canonicalTableName(tableId), nickname: nickname?.trim() || null }
          : t,
      ),
    )
  }, [])

  const addTable = useCallback(async () => {
    const maxId = tables.reduce((m, t) => Math.max(m, t.id), 0)
    const nextId = maxId + 1
    if (nextId > MAX_TABLE_ID) {
      throw new Error(`En fazla ${MAX_TABLE_ID} masa ekleyebilirsiniz.`)
    }
    await insertTableRow(nextId)
    const name = canonicalTableName(nextId)
    setTables((prev) => sortTables([...prev, { id: nextId, name, nickname: null }]))
  }, [tables])

  const removeTable = useCallback(async (tableId: number) => {
    await deleteTableRow(tableId)
    setTables((prev) => prev.filter((t) => t.id !== tableId))
  }, [])

  return { tables, names, setNickname, addTable, removeTable, refreshTables: load }
}
