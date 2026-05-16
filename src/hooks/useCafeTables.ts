import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CafeTable } from '@/constants/tables'
import { CAFE_TABLES, MAX_TABLE_ID, canonicalTableName, tableDisplayLabel } from '@/constants/tables'
import { supabase } from '@/lib/supabaseClient'
import { fetchTableNames, insertTableRow, upsertTableNickname, deleteTableRow } from '@/services/tableRepository'

function sortTables(list: CafeTable[]): CafeTable[] {
  return [...list].sort((a, b) => a.id - b.id)
}

export function useCafeTables(businessId: string | null) {
  const [tables, setTables] = useState<CafeTable[]>(() => [...CAFE_TABLES])
  const [tablesLoading, setTablesLoading] = useState(true)

  const load = useCallback(async () => {
    if (!businessId) {
      setTables([...CAFE_TABLES])
      setTablesLoading(false)
      return
    }
    try {
      const rows = await fetchTableNames(businessId)
      if (rows.length > 0) {
        setTables(
          rows.map((r) => ({
            id: r.id,
            name: canonicalTableName(r.id),
            nickname: r.nickname,
            lastOrderAttentionClearedAt: r.lastOrderAttentionClearedAt,
          })),
        )
      }
    } catch {
      /* varsayılan CAFE_TABLES kalır */
    } finally {
      setTablesLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    setTablesLoading(true)
    void load()
  }, [load])

  useEffect(() => {
    if (!businessId) return () => {}
    const filter = `business_id=eq.${businessId}`
    const channel = supabase
      .channel(`cafe_tables_${businessId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cafe_tables', filter },
        () => {
          void load()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [businessId, load])

  const names = useMemo(
    () => new Map<number, string>(tables.map((t) => [t.id, tableDisplayLabel(t)] as const)),
    [tables],
  )

  const setNickname = useCallback(
    async (tableId: number, nickname: string | null) => {
      if (!businessId) return
      await upsertTableNickname(businessId, tableId, nickname)
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? { ...t, name: canonicalTableName(tableId), nickname: nickname?.trim() || null }
            : t,
        ),
      )
    },
    [businessId],
  )

  const addTable = useCallback(async () => {
    if (!businessId) return
    const maxId = tables.reduce((m, t) => Math.max(m, t.id), 0)
    const nextId = maxId + 1
    if (nextId > MAX_TABLE_ID) {
      throw new Error(`En fazla ${MAX_TABLE_ID} masa ekleyebilirsiniz.`)
    }
    await insertTableRow(businessId, nextId)
    const name = canonicalTableName(nextId)
    setTables((prev) =>
      sortTables([
        ...prev,
        { id: nextId, name, nickname: null, lastOrderAttentionClearedAt: null },
      ]),
    )
  }, [businessId, tables])

  const removeTable = useCallback(
    async (tableId: number) => {
      if (!businessId) return
      await deleteTableRow(businessId, tableId)
      setTables((prev) => prev.filter((t) => t.id !== tableId))
    },
    [businessId],
  )

  return {
    tables,
    names,
    setNickname,
    addTable,
    removeTable,
    refreshTables: load,
    tablesLoading,
  }
}
