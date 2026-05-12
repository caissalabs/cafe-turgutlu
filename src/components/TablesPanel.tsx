import { useMemo, useState } from 'react'
import { OrderPreparedModal } from '@/components/OrderPreparedModal'
import { TableCardMenu } from '@/components/TableCardMenu'
import { CAFE_TABLES } from '@/constants/tables'
import { formatPriceTry } from '@/constants/menu'
import type { CafeOrder } from '@/types/order'
import { cn } from '@/utils/cn'
import styles from './TablesPanel.module.css'

type TablesPanelProps = {
  orders: CafeOrder[]
  loading: boolean
  onOrdersRefresh: () => void | Promise<void>
  attentionTableIds: ReadonlySet<number>
  onClearTableAttention: (tableId: number) => void
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function TablesPanel({
  orders,
  loading,
  onOrdersRefresh,
  attentionTableIds,
  onClearTableAttention,
}: TablesPanelProps) {
  const [preparedTableId, setPreparedTableId] = useState<number | null>(null)

  const byTable = useMemo(() => {
    const map = new Map<number, CafeOrder[]>()
    for (const t of CAFE_TABLES) map.set(t.id, [])
    for (const o of orders) {
      const list = map.get(o.tableNumber)
      if (list) list.push(o)
      else map.set(o.tableNumber, [o])
    }
    for (const [, list] of map) {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return map
  }, [orders])

  return (
    <div className={styles.wrap}>
      <OrderPreparedModal
        tableId={preparedTableId}
        onCancel={() => setPreparedTableId(null)}
        onConfirm={() => {
          if (preparedTableId != null) {
            onClearTableAttention(preparedTableId)
          }
          setPreparedTableId(null)
        }}
      />
      <h2 className={styles.heading}>Masalar ve siparişler</h2>
      <p className={styles.hint}>
        QR ile gelen müşteriler <code className={styles.code}>masa</code> parametresiyle kaydedilir; burada masa
        bazında görürsünüz.
      </p>
      {loading ? <p className={styles.loading}>Yükleniyor…</p> : null}
      <ul className={styles.grid} aria-label="Masalar">
        {CAFE_TABLES.map((table) => {
          const tableOrders = byTable.get(table.id) ?? []
          const sum = tableOrders.reduce((acc, o) => acc + o.totalTry, 0)
          const needsAttention = attentionTableIds.has(table.id)
          return (
            <li
              key={table.id}
              className={cn(styles.card, needsAttention && styles.cardAttention)}
            >
              <div className={styles.cardTop}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>{table.name}</span>
                  <span className={styles.cardMeta}>Masa {table.id}</span>
                </div>
                <TableCardMenu
                  tableNumber={table.id}
                  orderCount={tableOrders.length}
                  onResetComplete={onOrdersRefresh}
                />
              </div>
              <div className={styles.cardTotals}>
                <span className={styles.orderCount}>{tableOrders.length} sipariş</span>
                <span className={styles.sum}>{formatPriceTry(sum)}</span>
              </div>
              {needsAttention ? (
                <button
                  type="button"
                  className={styles.preparedBtn}
                  onClick={() => setPreparedTableId(table.id)}
                >
                  Sipariş hazırlandı
                </button>
              ) : null}
              {tableOrders.length === 0 ? (
                <p className={styles.empty}>Henüz sipariş yok</p>
              ) : (
                <ul className={styles.orderList}>
                  {tableOrders.map((o) => (
                    <li key={o.id} className={styles.order}>
                      <div className={styles.orderTop}>
                        <time className={styles.time} dateTime={o.createdAt}>
                          {formatWhen(o.createdAt)}
                        </time>
                        <span className={styles.orderSum}>{formatPriceTry(o.totalTry)}</span>
                      </div>
                      <ul className={styles.lines}>
                        {o.lines.map((line) => (
                          <li key={`${o.id}-${line.key}`} className={styles.line}>
                            <span>
                              {line.name}{' '}
                              <span className={styles.dim}>×{line.qty}</span>
                            </span>
                            <span>{formatPriceTry(line.price * line.qty)}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
