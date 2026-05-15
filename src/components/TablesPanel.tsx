import { useMemo, useState } from 'react'
import { OrderPreparedModal } from '@/components/OrderPreparedModal'
import { TableCardMenu } from '@/components/TableCardMenu'
import { TableDetailModal } from '@/components/TableDetailModal'
import { TableMasaIcon } from '@/components/TableMasaIcon'
import type { CafeTable } from '@/constants/tables'
import { MAX_TABLE_ID, MIN_TABLE_COUNT, tableDisplayLabel } from '@/constants/tables'
import { formatPriceTry } from '@/constants/menu'
import { deleteOrdersForTable, transferOrdersBetweenTables } from '@/services/orderRepository'
import type { CafeOrder } from '@/types/order'
import { cn } from '@/utils/cn'
import styles from './TablesPanel.module.css'

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
  const [preparedTableId, setPreparedTableId] = useState<number | null>(null)
  const [detailTableId, setDetailTableId] = useState<number | null>(null)
  const [addError, setAddError] = useState<string | null>(null)

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

      <h2 className={styles.heading}>Masalar ve siparişler</h2>
      <p className={styles.hint}>
        QR ile gelen müşteriler <code className={styles.code}>masa</code> parametresiyle kaydedilir;
        burada masa bazında görürsünüz.
      </p>
      {loading ? <p className={styles.loading}>Yükleniyor…</p> : null}
      {addError ? (
        <p className={styles.addErr} role="alert">
          {addError}
        </p>
      ) : null}

      <ul className={styles.grid} aria-label="Masalar">
        {tables.map((table) => {
          const tableOrders = byTable.get(table.id) ?? []
          const sum = tableOrders.reduce((acc, o) => acc + o.totalTry, 0)
          const needsAttention = attentionTableIds.has(table.id)
          const tableName = names.get(table.id) ?? tableDisplayLabel(table)
          const itemCount = tableOrders.reduce((acc, o) => acc + o.lines.reduce((s, l) => s + l.qty, 0), 0)
          const otherTables = tables
            .filter((t) => t.id !== table.id)
            .map((t) => ({ id: t.id, name: tableDisplayLabel(t) }))

          return (
            <li key={table.id} className={styles.card}>
              {itemCount > 0 && (
                <span className={styles.itemBadge} aria-label={`${itemCount} ürün`}>
                  {itemCount}
                </span>
              )}

              <div className={styles.cardMenu}>
                <TableCardMenu
                  businessId={businessId}
                  tableNumber={table.id}
                  tableName={tableName}
                  orderCount={tableOrders.length}
                  otherTables={otherTables}
                  canDeleteTable={canDeleteAnyTable}
                  tableNickname={table.nickname}
                  onResetComplete={onOrdersRefresh}
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
                  }}
                />
              </div>

              <button
                type="button"
                className={styles.cardBody}
                onClick={() => setDetailTableId(table.id)}
                aria-label={`${tableName} detaylarını görüntüle`}
              >
                <TableMasaIcon label={tableName} highlight={needsAttention} />

                <div className={styles.cardTotals}>
                  <span className={styles.orderCount}>{tableOrders.length} sipariş</span>
                  <span className={styles.sum}>{formatPriceTry(sum)}</span>
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
            <span className={styles.addPlus} aria-hidden>
              +
            </span>
          </button>
        </li>
      </ul>
    </div>
  )
}
