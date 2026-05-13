import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { deleteOrdersForTable } from '@/services/orderRepository'
import styles from './TableCardMenu.module.css'

type ModalPhase = 'idle' | 'confirm-reset' | 'loading' | 'error' | 'rename' | 'transfer'

type TableOption = {
  id: number
  name: string
}

type TableCardMenuProps = {
  tableNumber: number
  tableName: string
  orderCount: number
  otherTables: TableOption[]
  onResetComplete: () => void | Promise<void>
  onRename: (name: string) => Promise<void>
  onTransfer: (toTableId: number) => Promise<void>
}

export function TableCardMenu({
  tableNumber,
  tableName,
  orderCount,
  otherTables,
  onResetComplete,
  onRename,
  onTransfer,
}: TableCardMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [phase, setPhase] = useState<ModalPhase>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState(tableName)
  const [transferTarget, setTransferTarget] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()

  const modalActive = phase !== 'idle'
  const loading = phase === 'loading'

  useEffect(() => {
    if (phase === 'rename') {
      setRenameValue(tableName)
      setTimeout(() => inputRef.current?.select(), 50)
    }
    if (phase === 'transfer') {
      setTransferTarget('')
    }
  }, [phase, tableName])

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
    if (phase === 'idle' || phase === 'loading') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  const openConfirmReset = () => {
    if (orderCount === 0 || loading) return
    setMenuOpen(false)
    setErrorMsg(null)
    setPhase('confirm-reset')
  }

  const openRename = () => {
    setMenuOpen(false)
    setPhase('rename')
  }

  const openTransfer = () => {
    if (orderCount === 0 || loading || otherTables.length === 0) return
    setMenuOpen(false)
    setErrorMsg(null)
    setPhase('transfer')
  }

  const closeModal = () => {
    if (loading) return
    setPhase('idle')
    setErrorMsg(null)
  }

  const backdropDismiss = () => {
    if (phase !== 'idle' && phase !== 'loading') closeModal()
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

  const runRename = async () => {
    const trimmed = renameValue.trim()
    if (!trimmed) return
    setPhase('loading')
    try {
      await onRename(trimmed)
      setPhase('idle')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'İsim kaydedilemedi.')
      setPhase('error')
    }
  }

  const runTransfer = async () => {
    const toId = Number.parseInt(transferTarget, 10)
    if (!Number.isFinite(toId) || toId === tableNumber) return
    setPhase('loading')
    try {
      await onTransfer(toId)
      await onResetComplete()
      setPhase('idle')
      setErrorMsg(null)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Aktarım başarısız.')
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
          {phase === 'confirm-reset' ? (
            <>
              <h2 className={styles.modalTitle} id={titleId}>
                Masayı sıfırla?
              </h2>
              <p className={styles.modalText}>
                <strong>{tableName}</strong> için kayıtlı tüm siparişler silinecek. Bu işlem geri
                alınamaz.
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

          {phase === 'rename' ? (
            <>
              <h2 className={styles.modalTitle} id={titleId}>
                Masa ismini değiştir
              </h2>
              <label className={styles.inputLabel} htmlFor={`${titleId}-rename`}>
                Yeni isim
              </label>
              <input
                ref={inputRef}
                id={`${titleId}-rename`}
                className={styles.input}
                type="text"
                value={renameValue}
                maxLength={40}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void runRename()
                }}
              />
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnGhost} onClick={closeModal}>
                  Vazgeç
                </button>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  disabled={!renameValue.trim()}
                  onClick={() => void runRename()}
                >
                  Kaydet
                </button>
              </div>
            </>
          ) : null}

          {phase === 'transfer' ? (
            <>
              <h2 className={styles.modalTitle} id={titleId}>
                Siparişleri aktar
              </h2>
              <p className={styles.modalText}>
                <strong>{tableName}</strong> üzerindeki tüm sipariş kayıtları seçtiğiniz masaya
                taşınır.
              </p>
              <label className={styles.inputLabel} htmlFor={`${titleId}-transfer`}>
                Hedef masa
              </label>
              <select
                id={`${titleId}-transfer`}
                className={styles.select}
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value)}
              >
                <option value="">Seçin…</option>
                {otherTables.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnGhost} onClick={closeModal}>
                  Vazgeç
                </button>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  disabled={!transferTarget}
                  onClick={() => void runTransfer()}
                >
                  Aktar
                </button>
              </div>
            </>
          ) : null}

          {phase === 'loading' ? (
            <div className={styles.loadingBox}>
              <div className={styles.spinner} aria-hidden />
              <p className={styles.loadingText}>İşleniyor…</p>
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
          aria-label={`${tableName}, daha fazla`}
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
              <button type="button" role="menuitem" className={styles.menuItem} onClick={openRename}>
                İsmi değiştir
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                disabled={orderCount === 0 || loading || otherTables.length === 0}
                onClick={openTransfer}
              >
                Başka masaya aktar
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                disabled={orderCount === 0 || loading}
                onClick={openConfirmReset}
              >
                Siparişleri sıfırla
              </button>
            </li>
          </ul>
        ) : null}
      </div>
    </>
  )
}
