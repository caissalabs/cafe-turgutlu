import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatPriceTry } from '@/constants/menu'
import { useCafeMenu } from '@/hooks/useCafeMenu'
import { deleteOrderById, submitOrder, updateOrder } from '@/services/orderRepository'
import type { CafeOrder, OrderLine } from '@/types/order'
import styles from './StaffTableOrderModal.module.css'

const NEW_ORDER = '__new__'

function safeOrderLines(o: CafeOrder): OrderLine[] {
  if (!Array.isArray(o.lines)) return []
  return o.lines.map((l) => ({ ...l }))
}

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
  /** Bu masadaki mevcut siparişler (yeniden eskiye); boşsa yalnızca yeni sipariş. */
  existingOrders: CafeOrder[]
  onClose: () => void
  onSaved: () => void | Promise<void>
}

export function StaffTableOrderModal({
  businessId,
  tableNumber,
  tableLabel,
  existingOrders,
  onClose,
  onSaved,
}: StaffTableOrderModalProps) {
  const titleId = useId()
  const {
    categories,
    loading: menuLoading,
    isConfigured: menuConfigured,
    error: menuError,
  } = useCafeMenu(businessId, { subscribeRealtime: false })

  const [targetKey, setTargetKey] = useState<string>(NEW_ORDER)
  const [draftLines, setDraftLines] = useState<OrderLine[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isNew = targetKey === NEW_ORDER
  const activeOrder = !isNew ? existingOrders.find((o) => o.id === targetKey) : undefined

  /* Seçilen hedef silinmiş veya liste boşaldıysa yeni siparişe dön */
  useEffect(() => {
    if (targetKey === NEW_ORDER) return
    if (!existingOrders.some((o) => o.id === targetKey)) {
      setTargetKey(NEW_ORDER)
    }
  }, [existingOrders, targetKey])

  /* Hedef veya sunucu verisi değişince taslağı senkronle */
  useEffect(() => {
    if (targetKey === NEW_ORDER) {
      setDraftLines([])
      return
    }
    const o = existingOrders.find((x) => x.id === targetKey)
    if (o) setDraftLines(safeOrderLines(o))
  }, [targetKey, existingOrders])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving, onClose])

  const handleSend = async () => {
    setError(null)
    const total = totalOf(draftLines)

    if (isNew) {
      if (draftLines.length === 0) {
        setError('Göndermek için en az bir ürün seçin.')
        return
      }
      setSaving(true)
      try {
        await submitOrder(businessId, {
          tableNumber,
          lines: draftLines,
          totalTry: total,
        })
        await onSaved()
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Sipariş gönderilemedi.')
      } finally {
        setSaving(false)
      }
      return
    }

    if (!activeOrder) {
      setError('Sipariş bulunamadı.')
      return
    }

    setSaving(true)
    try {
      if (draftLines.length === 0) {
        await deleteOrderById(businessId, activeOrder.id)
      } else {
        await updateOrder(businessId, activeOrder.id, {
          lines: draftLines,
          totalTry: total,
        })
      }
      await onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kayıt başarısız.')
    } finally {
      setSaving(false)
    }
  }

  const onPlus = (itemId: string, name: string, price: number) => {
    if (saving) return
    setDraftLines((prev) => addQtyToLines(prev, itemId, name, price))
  }

  const onMinus = (itemId: string) => {
    if (saving) return
    setDraftLines((prev) => {
      const cur = prev.find((l) => l.key === itemId)?.qty ?? 0
      if (cur <= 0) return prev
      return removeQtyFromLines(prev, itemId)
    })
  }

  const lineTotal = totalOf(draftLines)
  const showTargetPick = existingOrders.length > 0
  const canSend = isNew ? draftLines.length > 0 : Boolean(activeOrder)
  const sendDisabled = saving || !canSend || menuLoading || !menuConfigured

  if (typeof document === 'undefined' || !document.body) {
    return null
  }

  return createPortal(
    <div className={styles.root}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Kapat"
        disabled={saving}
        onClick={() => {
          if (!saving) onClose()
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
              Sipariş ekle / düzenle
            </h2>
            <p className={styles.subtitle}>
              <span className={styles.tableTag}>{tableLabel}</span>
              {!isNew && activeOrder ? (
                <span className={styles.metaMuted}>
                  {' '}
                  · {formatWhen(activeOrder.createdAt)}
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Kapat"
            disabled={saving}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {showTargetPick ? (
          <div className={styles.orderPick}>
            <label className={styles.orderPickLabel} htmlFor={`${titleId}-target`}>
              Ne yapmak istersiniz?
            </label>
            <select
              id={`${titleId}-target`}
              className={styles.select}
              value={targetKey}
              disabled={saving}
              onChange={(e) => {
                setTargetKey(e.target.value)
                setError(null)
              }}
            >
              <option value={NEW_ORDER}>Yeni sipariş oluştur</option>
              {existingOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  Mevcut: {formatWhen(o.createdAt)} — {formatPriceTry(o.totalTry)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className={styles.body}>
          <p className={styles.hint}>
            Menüden ürün ve adet seçin; kayıt alttaki <strong>Gönder</strong> ile sunucuya gider.
            {showTargetPick ? (
              <>
                {' '}
                Mevcut bir siparişi seçtiyseniz değişiklikler o kayda yazılır; tüm ürünleri kaldırırsanız o
                sipariş <strong>silinir</strong>.
              </>
            ) : null}
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
                      const qty = draftLines.find((l) => l.key === item.id)?.qty ?? 0
                      return (
                        <li key={item.id} className={styles.item}>
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className={styles.thumb}
                              width={56}
                              height={56}
                            />
                          ) : (
                            <div className={styles.thumbPh} aria-hidden />
                          )}
                          <div className={styles.itemInfo}>
                            <div className={styles.itemMain}>
                              <span className={styles.itemName}>{item.name}</span>
                              <span className={styles.itemPrice}>
                                {formatPriceTry(Number.isFinite(item.price) ? item.price : 0)}
                              </span>
                            </div>
                            {(item.description ?? '').trim() ? (
                              <p className={styles.itemDesc}>{item.description}</p>
                            ) : null}
                          </div>
                          <div className={styles.actions}>
                            <button
                              type="button"
                              className={styles.qtyBtn}
                              aria-label={`${item.name} azalt`}
                              disabled={saving || qty === 0}
                              onClick={() => onMinus(item.id)}
                            >
                              −
                            </button>
                            <span className={styles.qtyVal}>{qty}</span>
                            <button
                              type="button"
                              className={styles.qtyBtn}
                              aria-label={`${item.name} ekle`}
                              disabled={saving}
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
          {draftLines.length > 0 ? (
            <ul className={styles.draftList} aria-label="Taslak sipariş">
              {draftLines.map((l) => (
                <li key={l.key} className={styles.draftRow}>
                  <span className={styles.draftName}>
                    {l.name} <span className={styles.draftQty}>×{l.qty}</span>
                  </span>
                  <span className={styles.draftSum}>{formatPriceTry(l.price * l.qty)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.draftEmpty}>
              {isNew
                ? 'Henüz ürün seçilmedi.'
                : 'Liste boş — gönderirseniz bu sipariş silinir.'}
            </p>
          )}

          <div className={styles.footerTotals}>
            <div>
              <div className={styles.totalLabel}>Ara toplam</div>
              <div className={styles.totalVal}>{formatPriceTry(lineTotal)}</div>
            </div>
            <button
              type="button"
              className={styles.submitBtn}
              disabled={sendDisabled}
              onClick={() => void handleSend()}
            >
              {saving ? 'Gönderiliyor…' : 'Gönder'}
            </button>
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
