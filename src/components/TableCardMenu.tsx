import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { deleteOrdersForTable } from '@/services/orderRepository'
import styles from './TableCardMenu.module.css'

type ModalPhase = 'idle' | 'confirm' | 'loading' | 'error'

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
  const [menuOpen, setMenuOpen] = useState(false)
  const [phase, setPhase] = useState<ModalPhase>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  const modalActive = phase !== 'idle'
  const loading = phase === 'loading'

  useEffect(() => {
    if (!menuOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return
      setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!modalActive) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [modalActive])

  useEffect(() => {
    if (phase !== 'confirm' && phase !== 'error') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPhase('idle')
        setErrorMsg(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  const openConfirm = () => {
    if (orderCount === 0 || loading) return
    setMenuOpen(false)
    setErrorMsg(null)
    setPhase('confirm')
  }

  const closeModal = () => {
    if (loading) return
    setPhase('idle')
    setErrorMsg(null)
  }

  const backdropDismiss = () => {
    if (phase === 'confirm' || phase === 'error') closeModal()
  }

  const runReset = async () => {
    setPhase('loading')
    try {
      await deleteOrdersForTable(tableNumber)
      await onResetComplete()
      setPhase('idle')
      setErrorMsg(null)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Masayı sıfırlayamadık.')
      setPhase('error')
    }
  }

  const modal =
    modalActive &&
    createPortal(
      <div className={styles.modalRoot}>
        <button
          type="button"
          className={styles.modalBackdrop}
          aria-label="Pencereyi kapat"
          disabled={loading}
          onClick={backdropDismiss}
        />
        <div
          className={styles.modalPanel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          {phase === 'confirm' ? (
            <>
              <h2 className={styles.modalTitle} id={titleId}>
                Masayı sıfırla?
              </h2>
              <p className={styles.modalText}>
                <strong>Masa {tableNumber}</strong> için kayıtlı tüm siparişler silinecek. Bu işlem geri alınamaz.
              </p>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnGhost} onClick={closeModal}>
                  Vazgeç
                </button>
                <button type="button" className={styles.btnDanger} onClick={() => void runReset()}>
                  Sıfırla
                </button>
              </div>
            </>
          ) : null}
          {phase === 'loading' ? (
            <div className={styles.loadingBox}>
              <div className={styles.spinner} aria-hidden />
              <p className={styles.loadingText}>Sıfırlanıyor…</p>
            </div>
          ) : null}
          {phase === 'error' ? (
            <>
              <h2 className={styles.modalTitle} id={titleId}>
                İşlem başarısız
              </h2>
              <p className={styles.modalText}>{errorMsg}</p>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnPrimary} onClick={closeModal}>
                  Tamam
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>,
      document.body,
    )

  return (
    <>
      {modal}
      <div className={styles.wrap} ref={wrapRef}>
        <button
          type="button"
          className={styles.kebab}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={`Masa ${tableNumber}, daha fazla`}
          disabled={loading}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </button>
        {menuOpen ? (
          <ul className={styles.menu} role="menu">
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                disabled={orderCount === 0 || loading}
                onClick={openConfirm}
              >
                Masayı sıfırla
              </button>
            </li>
          </ul>
        ) : null}
      </div>
    </>
  )
}
