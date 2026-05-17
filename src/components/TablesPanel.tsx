import { useId, useMemo, useState } from 'react'
import { OrderPreparedModal } from '@/components/OrderPreparedModal'
import { StaffTableOrderModal } from '@/components/StaffTableOrderModal'
import { TableCardMenu } from '@/components/TableCardMenu'
import { TableDetailModal } from '@/components/TableDetailModal'
import { LiveWorkspaceClock } from '@/components/LiveWorkspaceClock'
import { TableMasaIcon } from '@/components/TableMasaIcon'
import type { CafeTable } from '@/constants/tables'
import { MAX_TABLE_ID, MIN_TABLE_COUNT, tableDisplayLabel } from '@/constants/tables'
import { formatPriceTry } from '@/constants/menu'
import { deleteOrdersForTable, transferOrdersBetweenTables } from '@/services/orderRepository'
import type { CafeOrder } from '@/types/order'
import { cn } from '@/utils/cn'
import styles from './TablesPanel.module.css'

type FilterTab = 'all' | 'occupied' | 'available'

function normalizeTableSearch(raw: string): string {
  return raw
    .trim()
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function tableMatchesSearch(tableId: number, displayLabel: string, query: string): boolean {
  if (!query.trim()) return true
  const q = normalizeTableSearch(query)
  if (!q) return true
  const labelNorm = normalizeTableSearch(displayLabel)
  const canonical = normalizeTableSearch(`Masa ${tableId}`)
  const numeric = normalizeTableSearch(String(tableId))
  return canonical.includes(q) || labelNorm.includes(q) || numeric.includes(q)
}

type TablesPanelProps = {
  businessId: string | null
  orders: CafeOrder[]
  loading: boolean
  onOrdersRefresh: () => void | Promise<void>
  attentionTableIds: ReadonlySet<number>
  onClearTableAttention: (tableId: number) => Promise<void>
  tables: CafeTable[]
  names: ReadonlyMap<number, string>
  setNickname: (tableId: number, nickname: string | null) => Promise<void>
  addTable: () => Promise<void>
  removeTable: (tableId: number) => Promise<void>
}

export function TablesPanel({
  businessId,
  orders,
  loading,
  onOrdersRefresh,
  attentionTableIds,
  onClearTableAttention,
  tables,
  names,
  setNickname,
  addTable,
  removeTable,
}: TablesPanelProps) {
  const searchFieldId = useId()
  const [preparedTableId, setPreparedTableId] = useState<number | null>(null)
  const [detailTableId, setDetailTableId] = useState<number | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [staffOrderTableId, setStaffOrderTableId] = useState<number | null>(null)
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const byTable = useMemo(() => {
    const map = new Map<number, CafeOrder[]>()
    for (const t of tables) map.set(t.id, [])
    for (const o of orders) {
      const list = map.get(o.tableNumber)
      if (list) list.push(o)
      else map.set(o.tableNumber, [o])
    }
    for (const [, list] of map) {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return map
  }, [orders, tables])

  const detailOrders = detailTableId != null ? (byTable.get(detailTableId) ?? []) : []
  const detailTableName =
    detailTableId != null ? (names.get(detailTableId) ?? `Masa ${detailTableId}`) : ''
  const detailSum = detailOrders.reduce((acc, o) => acc + o.totalTry, 0)
  const detailNeedsAttention = detailTableId != null && attentionTableIds.has(detailTableId)

  const lastTableId = tables.length ? tables[tables.length - 1]!.id : 0
  const canAddTable = lastTableId < MAX_TABLE_ID
  const canDeleteAnyTable = tables.length > MIN_TABLE_COUNT

  const visibleTables = useMemo(() => {
    let rows = tables
    if (filterTab === 'occupied') {
      rows = rows.filter((t) => (byTable.get(t.id)?.length ?? 0) > 0)
    } else if (filterTab === 'available') {
      rows = rows.filter((t) => (byTable.get(t.id)?.length ?? 0) === 0)
    }
    if (searchQuery.trim()) {
      rows = rows.filter((t) =>
        tableMatchesSearch(t.id, names.get(t.id) ?? tableDisplayLabel(t), searchQuery),
      )
    }
    return rows
  }, [tables, byTable, filterTab, names, searchQuery])

  const showEmptyFilter =
    !loading &&
    tables.length > 0 &&
    visibleTables.length === 0 &&
    (filterTab !== 'all' || searchQuery.trim().length > 0)

  return (
    <div className={styles.wrap}>
      <OrderPreparedModal
        tableId={preparedTableId}
        onCancel={() => setPreparedTableId(null)}
        onConfirm={() => {
          if (preparedTableId != null) void onClearTableAttention(preparedTableId)
          setPreparedTableId(null)
        }}
      />

      {detailTableId != null && (
        <TableDetailModal
          tableName={detailTableName}
          orders={detailOrders}
          totalSum={detailSum}
          needsAttention={detailNeedsAttention}
          onPrepared={() => setPreparedTableId(detailTableId)}
          onClose={() => setDetailTableId(null)}
        />
      )}

      {staffOrderTableId != null && businessId ? (
        <StaffTableOrderModal
          businessId={businessId}
          tableNumber={staffOrderTableId}
          tableLabel={names.get(staffOrderTableId) ?? `Masa ${staffOrderTableId}`}
          existingOrders={byTable.get(staffOrderTableId) ?? []}
          onClose={() => setStaffOrderTableId(null)}
          onSaved={onOrdersRefresh}
        />
      ) : null}

      <header className={styles.pageHeader}>
        <h2 className={styles.heading}>Masalar ve Siparişler</h2>
        <p className={styles.hint}>
          QR ile gelen müşteriler <code className={styles.code}>masa</code> parametresiyle kaydedilir;
          burada masa bazında görürsünüz.
        </p>
        <div className={styles.clockSlot}>
          <LiveWorkspaceClock variant="dense" />
        </div>
      </header>

      <div
        className={styles.filterBar}
        role="toolbar"
        aria-label="Masa filtresi ve arama"
      >
        <div className={styles.filterRail} role="group" aria-label="Duruma göre filtre">
          <button
            type="button"
            className={cn(styles.filterBtn, filterTab === 'all' && styles.filterBtnActive)}
            aria-pressed={filterTab === 'all'}
            onClick={() => setFilterTab('all')}
          >
            Tüm masalar
          </button>
          <button
            type="button"
            className={cn(styles.filterBtn, filterTab === 'occupied' && styles.filterBtnActive)}
            aria-pressed={filterTab === 'occupied'}
            onClick={() => setFilterTab('occupied')}
          >
            Dolu
          </button>
          <button
            type="button"
            className={cn(styles.filterBtn, filterTab === 'available' && styles.filterBtnActive)}
            aria-pressed={filterTab === 'available'}
            onClick={() => setFilterTab('available')}
          >
            Müsait
          </button>
        </div>
        <div className={styles.searchWrap}>
          <span className={cn('material-symbols-outlined', styles.searchIcon)} aria-hidden>
            search
          </span>
          <label htmlFor={searchFieldId} className={styles.visuallyHidden}>
            Masa ara
          </label>
          <input
            id={searchFieldId}
            className={styles.searchInput}
            type="search"
            placeholder="Masa ara…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      {loading ? <p className={styles.loading}>Yükleniyor…</p> : null}
      {addError ? (
        <p className={styles.addErr} role="alert">
          {addError}
        </p>
      ) : null}
      {showEmptyFilter ? (
        <p className={styles.filterEmpty}>
          Bu filtre veya aramaya uygun masa yok. Filtreyi sıfırlayın ya da başka anahtar kelime deneyin.
        </p>
      ) : null}

      <ul className={styles.grid} aria-label="Masalar">
        {visibleTables.map((table) => {
          const tableOrders = byTable.get(table.id) ?? []
          const sum = tableOrders.reduce((acc, o) => acc + o.totalTry, 0)
          const needsAttention = attentionTableIds.has(table.id)
          const occupied = tableOrders.length > 0
          const tableName = names.get(table.id) ?? tableDisplayLabel(table)
          const itemCount = tableOrders.reduce((acc, o) => acc + o.lines.reduce((s, l) => s + l.qty, 0), 0)
          const otherTables = tables
            .filter((t) => t.id !== table.id)
            .map((t) => ({ id: t.id, name: tableDisplayLabel(t) }))

          return (
            <li key={table.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <span
                  className={cn(
                    styles.statusBadge,
                    occupied ? styles.statusBadgeOccupied : styles.statusBadgeAvailable,
                  )}
                >
                  {occupied ? 'Dolu' : 'Müsait'}
                </span>
                <div className={styles.menuSlot}>
                  <TableCardMenu
                    businessId={businessId}
                    tableNumber={table.id}
                    tableName={tableName}
                    orderCount={tableOrders.length}
                    otherTables={otherTables}
                    canDeleteTable={canDeleteAnyTable}
                    tableNickname={table.nickname}
                    onResetComplete={async () => {
                      await onOrdersRefresh()
                      setStaffOrderTableId((cur) => (cur === table.id ? null : cur))
                    }}
                    onSetNickname={(nick) => setNickname(table.id, nick)}
                    onTransfer={async (toId) => {
                      if (!businessId) return
                      await transferOrdersBetweenTables(businessId, table.id, toId)
                      void onClearTableAttention(table.id)
                    }}
                    onDeleteTable={async () => {
                      if (!businessId) return
                      await deleteOrdersForTable(businessId, table.id)
                      await removeTable(table.id)
                      void onClearTableAttention(table.id)
                      setDetailTableId((cur) => (cur === table.id ? null : cur))
                      setStaffOrderTableId((cur) => (cur === table.id ? null : cur))
                    }}
                    onStaffOrder={
                      businessId ? () => setStaffOrderTableId(table.id) : undefined
                    }
                  />
                </div>
              </div>

              <button
                type="button"
                className={styles.cardBody}
                onClick={() => setDetailTableId(table.id)}
                aria-label={`${tableName} detaylarını görüntüle`}
              >
                <div className={styles.cardHero}>
                  {itemCount > 0 ? (
                    <span className={styles.itemBadge} aria-label={`${itemCount} ürün`}>
                      {itemCount}
                    </span>
                  ) : null}
                  <TableMasaIcon label={tableName} highlight={needsAttention} />
                </div>

                <div className={styles.statsBand}>
                  <div className={styles.statsCol}>
                    <p className={styles.statsLabel}>Sipariş</p>
                    <p className={styles.statsValuePlain}>
                      {occupied ? `${tableOrders.length} Sipariş` : '—'}
                    </p>
                  </div>
                  <div className={cn(styles.statsCol, styles.statsColTutarInk)}>
                    <p className={styles.statsLabel}>Tutar</p>
                    <p className={styles.statsValueCash}>{formatPriceTry(sum)}</p>
                  </div>
                </div>
              </button>

              {needsAttention && (
                <button type="button" className={styles.preparedBtn} onClick={() => setPreparedTableId(table.id)}>
                  Sipariş hazırlandı
                </button>
              )}
            </li>
          )
        })}

        <li className={cn(styles.card, styles.addCard)}>
          <button
            type="button"
            className={styles.addCardBtn}
            disabled={!canAddTable}
            aria-label="Yeni masa ekle"
            onClick={() => {
              setAddError(null)
              void addTable().catch((e) =>
                setAddError(e instanceof Error ? e.message : 'Masa eklenemedi.'),
              )
            }}
          >
            <span className={styles.addInner}>
              <span className={styles.addCircle}>
                <span className={styles.addPlus}>+</span>
              </span>
              <span className={styles.addLabel}>Masa ekle</span>
            </span>
          </button>
        </li>
      </ul>
    </div>
  )
}
