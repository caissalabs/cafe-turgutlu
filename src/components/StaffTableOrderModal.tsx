import { useCallback, useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatPriceTry } from '@/constants/menu'
import { useCafeMenu } from '@/hooks/useCafeMenu'
import {
  deleteOrderById,
  submitOrder,
  updateOrder,
} from '@/services/orderRepository'
import type { CafeOrder, OrderLine } from '@/types/order'
import styles from './StaffTableOrderModal.module.css'

function addQtyToLines(lines: OrderLine[], key: string, name: string, price: number): OrderLine[] {
  const idx = lines.findIndex((l) => l.key === key)
  if (idx === -1) return [...lines, { key, name, price, qty: 1 }]
  const next = [...lines]
  const cur = next[idx]!
  next[idx] = { ...cur, qty: cur.qty + 1 }
  return next
}

function removeQtyFromLines(lines: OrderLine[], key: string): OrderLine[] {
  const idx = lines.findIndex((l) => l.key === key)
  if (idx === -1) return lines
  const cur = lines[idx]!
  if (cur.qty <= 1) return lines.filter((_, i) => i !== idx)
  const next = [...lines]
  next[idx] = { ...cur, qty: cur.qty - 1 }
  return next
}

function totalOf(lines: OrderLine[]): number {
  return lines.reduce((s, l) => s + l.price * l.qty, 0)
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(iso),
    )
  } catch {
    return iso
  }
}

export type StaffTableOrderModalProps = {
  businessId: string
  tableNumber: number
  tableLabel: string
  mode: 'add' | 'edit'
  /** Düzenleme: bu masadaki siparişler (yeniden eskiye) */
  editOrders: CafeOrder[]
  onClose: () => void
  onSaved: () => void | Promise<void>
}

export function StaffTableOrderModal({
  businessId,
  tableNumber,
  tableLabel,
  mode,
  editOrders,
  onClose,
  onSaved,
}: StaffTableOrderModalProps) {
  const titleId = useId()
  const {
    categories,
    loading: menuLoading,
    isConfigured: menuConfigured,
    error: menuError,
  } = useCafeMenu(businessId)

  const [lines, setLines] = useState<OrderLine[]>([])
  const [orderId, setOrderId] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode === 'add') {
      setSelectedOrderId(null)
      setOrderId(null)
      setLines([])
      return
    }
    if (editOrders.length === 0) {
      setSelectedOrderId(null)
      setOrderId(null)
      setLines([])
      return
    }
    setSelectedOrderId((prev) =>
      prev && editOrders.some((o) => o.id === prev) ? prev : editOrders[0]!.id,
    )
  }, [mode, editOrders])

  useEffect(() => {
    if (mode !== 'edit' || !selectedOrderId || editOrders.length === 0) return
    const o = editOrders.find((x) => x.id === selectedOrderId)
    if (!o) return
    setOrderId(selectedOrderId)
    setLines(o.lines.map((l) => ({ ...l })))
  }, [mode, selectedOrderId, editOrders])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const onPickOrder = (orderIdPick: string) => {
    const o = editOrders.find((x) => x.id === orderIdPick)
    if (!o) return
    setSelectedOrderId(orderIdPick)
    setOrderId(orderIdPick)
    setLines(o.lines.map((l) => ({ ...l })))
    setError(null)
  }

  const persist = useCallback(
    async (nextLines: OrderLine[], currentOrderId: string | null): Promise<string | null> => {
      const tot = totalOf(nextLines)
      if (mode === 'add') {
        if (nextLines.length === 0) {
          if (currentOrderId) await deleteOrderById(businessId, currentOrderId)
          return null
        }
        if (!currentOrderId) {
          return await submitOrder(businessId, {
            tableNumber,
            lines: nextLines,
            totalTry: tot,
          })
        }
        await updateOrder(businessId, currentOrderId, { lines: nextLines, totalTry: tot })
        return currentOrderId
      }

      const sid = selectedOrderId
      if (!sid) throw new Error('Sipariş seçilmedi.')
      if (nextLines.length === 0) {
        await deleteOrderById(businessId, sid)
        return null
      }
      await updateOrder(businessId, sid, { lines: nextLines, totalTry: tot })
      return sid
    },
    [businessId, mode, selectedOrderId, tableNumber],
  )

  const runChange = async (nextLines: OrderLine[]) => {
    setBusy(true)
    setError(null)
    try {
      if (mode === 'edit' && !selectedOrderId) return

      const oid = mode === 'add' ? orderId : selectedOrderId
      const newId = await persist(nextLines, oid)

      if (mode === 'add') {
        setOrderId(newId)
        if (nextLines.length === 0) setLines([])
        else setLines(nextLines)
      } else {
        if (nextLines.length === 0) {
          setLines([])
          await onSaved()
          onClose()
          return
        }
        setLines(nextLines)
      }

      await onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi.')
    } finally {
      setBusy(false)
    }
  }

  const onPlus = (itemId: string, name: string, price: number) => {
    if (busy) return
    if (mode === 'edit' && !selectedOrderId) return
    void runChange(addQtyToLines(lines, itemId, name, price))
  }

  const onMinus = (itemId: string) => {
    if (busy) return
    const cur = lines.find((l) => l.key === itemId)?.qty ?? 0
    if (cur <= 0) return
    void runChange(removeQtyFromLines(lines, itemId))
  }

  const lineTotal = totalOf(lines)
  const showOrderPick = mode === 'edit' && editOrders.length > 1

  return createPortal(
    <div className={styles.root}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Kapat"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose()
        }}
      />
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <h2 className={styles.title} id={titleId}>
              {mode === 'add' ? 'Sipariş ekle' : 'Sipariş düzenle'}
            </h2>
            <p className={styles.subtitle}>
              {tableLabel}
              {mode === 'edit' && selectedOrderId
                ? ` · ${formatWhen(editOrders.find((o) => o.id === selectedOrderId)?.createdAt ?? '')}`
                : null}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Kapat"
            disabled={busy}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {showOrderPick ? (
          <div className={styles.orderPick}>
            <label className={styles.orderPickLabel} htmlFor={`${titleId}-ord`}>
              Hangi sipariş?
            </label>
            <select
              id={`${titleId}-ord`}
              className={styles.select}
              value={selectedOrderId ?? ''}
              disabled={busy}
              onChange={(e) => onPickOrder(e.target.value)}
            >
              {editOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {formatWhen(o.createdAt)} — {formatPriceTry(o.totalTry)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className={styles.body}>
          <p className={styles.hint}>
            Ürün yanındaki <strong>+</strong> her dokunuşta siparişe hemen eklenir ve kaydedilir; ayrı bir
            sepet adımı yok.
          </p>
          {menuError ? <p className={styles.error}>{menuError}</p> : null}
          {menuLoading ? <p className={styles.loadingMenu}>Menü yükleniyor…</p> : null}
          {!menuLoading && !menuConfigured ? (
            <p className={styles.loadingMenu}>Bu işletme için henüz menü yok.</p>
          ) : null}

          {!menuLoading && menuConfigured
            ? categories.map((category) => (
                <section key={category.id} aria-labelledby={`stf-${category.id}`}>
                  <h3 className={styles.catTitle} id={`stf-${category.id}`}>
                    {category.title}
                  </h3>
                  <ul className={styles.list}>
                    {category.items.map((item) => {
                      const qty = lines.find((l) => l.key === item.id)?.qty ?? 0
                      return (
                        <li key={item.id} className={styles.item}>
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className={styles.thumb}
                              width={44}
                              height={44}
                            />
                          ) : (
                            <div className={styles.thumbPh} aria-hidden />
                          )}
                          <div className={styles.itemInfo}>
                            <div className={styles.itemMain}>
                              <span className={styles.itemName}>{item.name}</span>
                              <span className={styles.itemPrice}>{formatPriceTry(item.price)}</span>
                            </div>
                            {item.description.trim() ? (
                              <p className={styles.itemDesc}>{item.description}</p>
                            ) : null}
                          </div>
                          <div className={styles.actions}>
                            <button
                              type="button"
                              className={styles.qtyBtn}
                              aria-label={`${item.name} azalt`}
                              disabled={busy || qty === 0}
                              onClick={() => onMinus(item.id)}
                            >
                              −
                            </button>
                            <span className={styles.qtyVal}>{qty}</span>
                            <button
                              type="button"
                              className={styles.qtyBtn}
                              aria-label={`${item.name} ekle`}
                              disabled={busy || (mode === 'edit' && !selectedOrderId)}
                              onClick={() => onPlus(item.id, item.name, item.price)}
                            >
                              +
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))
            : null}
        </div>

        <div className={styles.footer}>
          <div>
            <div className={styles.totalLabel}>Bu sipariş</div>
            <div className={styles.totalVal}>{formatPriceTry(lineTotal)}</div>
          </div>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
