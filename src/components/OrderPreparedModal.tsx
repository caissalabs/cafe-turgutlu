import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import styles from './OrderPreparedModal.module.css'

type OrderPreparedModalProps = {
  tableId: number | null
  onCancel: () => void
  onConfirm: () => void
}

export function OrderPreparedModal({
  tableId,
  onCancel,
  onConfirm,
}: OrderPreparedModalProps) {
  const titleId = useId()
  const open = tableId != null

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className={styles.root}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="İptal"
        onClick={onCancel}
      />
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className={styles.title}>
          Sipariş hazırlandı mı?
        </h2>
        <p className={styles.text}>
          <strong>Masa {tableId}</strong> için bildirimi kapatıp kutuyu normale döndürmek istiyor musunuz?
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={onCancel}>
            Hayır
          </button>
          <button type="button" className={styles.btnPrimary} onClick={onConfirm}>
            Evet
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
