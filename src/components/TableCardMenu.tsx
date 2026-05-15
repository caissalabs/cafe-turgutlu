import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { deleteOrdersForTable } from '@/services/orderRepository'
import { canonicalTableName } from '@/constants/tables'
import styles from './TableCardMenu.module.css'

type ModalPhase =
  | 'idle'
  | 'confirm-reset'
  | 'confirm-delete-table'
  | 'loading'
  | 'error'
  | 'rename'
  | 'transfer'

type TableOption = {
  id: number
  name: string
}

type TableCardMenuProps = {
  businessId: string | null
  tableNumber: number
  /** Kartta görünen etiket (takma ad veya Masa X). */
  tableName: string
  /** Düzenlenen takma ad; boşsa Masa no gösterilir. */
  tableNickname: string | null
  orderCount: number
  otherTables: TableOption[]
  /** En az bir masa kalsın isteniyorsa false */
  canDeleteTable: boolean
  onResetComplete: () => void | Promise<void>
  onSetNickname: (nickname: string | null) => Promise<void>
  onTransfer: (toTableId: number) => Promise<void>
  /** Siparişleri silip masa satırını kaldırır (üst bileşen uygular) */
  onDeleteTable: () => Promise<void>
  /** Masalar ekranı: personel siparişi — modal */
  onStaffAddOrder?: () => void
  onStaffEditOrder?: () => void
}

export function TableCardMenu({
  businessId,
  tableNumber,
  tableName,
  tableNickname,
  orderCount,
  otherTables,
  canDeleteTable,
  onResetComplete,
  onSetNickname,
  onTransfer,
  onDeleteTable,
  onStaffAddOrder,
  onStaffEditOrder,
}: TableCardMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [phase, setPhase] = useState<ModalPhase>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [nicknameDraft, setNicknameDraft] = useState('')
  const [transferTarget, setTransferTarget] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()

  const modalActive = phase !== 'idle'
  const loading = phase === 'loading'

  useEffect(() => {
    if (phase === 'rename') {
      setNicknameDraft(tableNickname?.trim() ?? '')
      setTimeout(() => inputRef.current?.select(), 50)
    }
    if (phase === 'transfer') {
      setTransferTarget('')
    }
  }, [phase, tableNickname])

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

  const openConfirmDeleteTable = () => {
    if (!canDeleteTable || loading) return
    setMenuOpen(false)
    setErrorMsg(null)
    setPhase('confirm-delete-table')
  }

  const openStaffAddOrder = () => {
    setMenuOpen(false)
    onStaffAddOrder?.()
  }

  const openStaffEditOrder = () => {
    if (orderCount === 0) return
    setMenuOpen(false)
    onStaffEditOrder?.()
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
    if (!businessId) {
      setErrorMsg('İşletme bilgisi eksik.')
      setPhase('error')
      return
    }
    setPhase('loading')
    try {
      await deleteOrdersForTable(businessId, tableNumber)
      await onResetComplete()
      setPhase('idle')
      setErrorMsg(null)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Masayı sıfırlayamadık.')
      setPhase('error')
    }
  }

  const runSetNickname = async () => {
    const trimmed = nicknameDraft.trim()
    setPhase('loading')
    try {
      await onSetNickname(trimmed || null)
      setPhase('idle')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Takma ad kaydedilemedi.')
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

  const runDeleteTable = async () => {
    setPhase('loading')
    try {
      await onDeleteTable()
      await onResetComplete()
      setPhase('idle')
      setErrorMsg(null)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Masa silinemedi.')
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
                Takma ad
              </h2>
              <p className={styles.modalText}>
                Buraya yazdığınız metin kartta ve seçim listelerinde görünür. Sipariş ve QR ile masa
                kimliği sabittir: <strong>{canonicalTableName(tableNumber)}</strong>.
              </p>
              <label className={styles.inputLabel} htmlFor={`${titleId}-nick`}>
                Görünen ad (boş bırakırsanız {canonicalTableName(tableNumber)} kullanılır)
              </label>
              <input
                ref={inputRef}
                id={`${titleId}-nick`}
                className={styles.input}
                type="text"
                value={nicknameDraft}
                maxLength={48}
                placeholder="Örn. Bahçe, Köşe…"
                onChange={(e) => setNicknameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void runSetNickname()
                }}
              />
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnGhost} onClick={closeModal}>
                  Vazgeç
                </button>
                <button type="button" className={styles.btnPrimary} onClick={() => void runSetNickname()}>
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

          {phase === 'confirm-delete-table' ? (
            <>
              <h2 className={styles.modalTitle} id={titleId}>
                Masayı sil?
              </h2>
              <p className={styles.modalText}>
                <strong>{tableName}</strong> listeden kaldırılır. Bu masaya ait tüm sipariş kayıtları da
                silinir. Bu işlem geri alınamaz.
              </p>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnGhost} onClick={closeModal}>
                  Vazgeç
                </button>
                <button type="button" className={styles.btnDanger} onClick={() => void runDeleteTable()}>
                  Masayı sil
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
            {onStaffAddOrder ? (
              <li role="none">
                <button type="button" role="menuitem" className={styles.menuItem} onClick={openStaffAddOrder}>
                  Sipariş ekle
                </button>
              </li>
            ) : null}
            {onStaffEditOrder ? (
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  disabled={orderCount === 0 || loading}
                  onClick={openStaffEditOrder}
                >
                  Sipariş düzenle
                </button>
              </li>
            ) : null}
            {(onStaffAddOrder || onStaffEditOrder) ? (
              <li className={styles.menuDivider} role="separator" />
            ) : null}
            <li role="none">
              <button type="button" role="menuitem" className={styles.menuItem} onClick={openRename}>
                Takma ad düzenle
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
            <li role="none" className={styles.menuDivider}>
              <button
                type="button"
                role="menuitem"
                className={`${styles.menuItem} ${styles.menuItemDeleteMasa}`}
                disabled={!canDeleteTable || loading}
                onClick={openConfirmDeleteTable}
              >
                Masayı sil
              </button>
            </li>
          </ul>
        ) : null}
      </div>
    </>
  )
}
