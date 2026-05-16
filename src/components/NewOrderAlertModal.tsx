import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import styles from './NewOrderAlertModal.module.css'

type NewOrderAlertModalProps = {
  open: boolean
  tableNumbers: number[]
  onDismiss: () => void
  /** Varsayılan: zil / tamam metni */
  hint?: string
  /** İkinci eylem (ör. Masalara git); genelde onDismiss ile birlikte zili kapatır */
  secondaryLabel?: string
  onSecondary?: () => void
}

export function NewOrderAlertModal({
  open,
  tableNumbers,
  onDismiss,
  hint = 'Zil sesini durdurmak için Tamam\'a basın.',
  secondaryLabel,
  onSecondary,
}: NewOrderAlertModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onDismiss])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  const label =
    tableNumbers.length === 1
      ? `Masa ${tableNumbers[0]}`
      : tableNumbers.map((n) => `Masa ${n}`).join(', ')

  return createPortal(
    <div className={styles.root}>
      <div className={styles.backdrop} aria-hidden />
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className={styles.title}>
          Yeni sipariş!
        </h2>
        <p className={styles.lead}>{label}</p>
        <p className={styles.hint}>{hint}</p>
        <div className={styles.actions}>
          {secondaryLabel && onSecondary ? (
            <>
              <button type="button" className={styles.ok} onClick={onSecondary}>
                {secondaryLabel}
              </button>
              <button type="button" className={styles.secondary} onClick={onDismiss}>
                Tamam
              </button>
            </>
          ) : (
            <button type="button" className={styles.ok} onClick={onDismiss}>
              Tamam
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
