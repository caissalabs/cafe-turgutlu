import { useEffect, useRef, useState } from 'react'
import { deleteOrdersForTable } from '@/services/orderRepository'
import styles from './TableCardMenu.module.css'

type TableCardMenuProps = {
  tableNumber: number
  orderCount: number
  onResetComplete: () => void | Promise<void>
}

export function TableCardMenu({
  tableNumber,
  orderCount,
  onResetComplete,
}: TableCardMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleReset = async () => {
    if (orderCount === 0 || busy) return
    if (
      !window.confirm(
        `Masa ${tableNumber} için tüm siparişleri silmek istediğinize emin misiniz?`,
      )
    ) {
      return
    }
    setOpen(false)
    setBusy(true)
    try {
      await deleteOrdersForTable(tableNumber)
      await onResetComplete()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Masayı sıfırlayamadık.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.kebab}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Masa ${tableNumber}, daha fazla`}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </button>
      {open ? (
        <ul className={styles.menu} role="menu">
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              disabled={orderCount === 0 || busy}
              onClick={() => void handleReset()}
            >
              Masayı sıfırla
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  )
}
