import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { formatPriceTry } from '@/constants/menu'
import type { CafeOrder } from '@/types/order'
import styles from './TableDetailModal.module.css'

type TableDetailModalProps = {
  tableName: string
  orders: CafeOrder[]
  totalSum: number
  needsAttention: boolean
  onPrepared: () => void
  onClose: () => void
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

export function TableDetailModal({
  tableName,
  orders,
  totalSum,
  needsAttention,
  onPrepared,
  onClose,
}: TableDetailModalProps) {
  const titleId = useId()

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className={styles.root}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Kapat"
        onClick={onClose}
      />
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title} id={titleId}>
            {tableName}
          </h2>
          <div className={styles.headerMeta}>
            {orders.length > 0 && (
              <span className={styles.totalBadge}>{formatPriceTry(totalSum)}</span>
            )}
            <button
              type="button"
              className={styles.closeBtn}
              aria-label="Kapat"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {orders.length === 0 ? (
            <p className={styles.empty}>Henüz sipariş yok</p>
          ) : (
            orders.map((o) => (
              <div key={o.id} className={styles.order}>
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
              </div>
            ))
          )}
        </div>

        {needsAttention && (
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.attentionBtn}
              onClick={() => {
                onPrepared()
                onClose()
              }}
            >
              Sipariş hazırlandı
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
