import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { MENU_CATEGORIES, formatPriceTry } from '@/constants/menu'
import { TABLE_COUNT } from '@/constants/tables'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useMasaNumber } from '@/hooks/useMasaNumber'
import { submitOrder } from '@/services/orderRepository'
import type { OrderLine } from '@/types/order'
import { cn } from '@/utils/cn'
import styles from './MenuPage.module.css'

export type MenuPageProps = {
  /** `staff`: yalnızca giriş yapılmış `/home/menu` rotası (Layout içinde). */
  variant?: 'public' | 'staff'
}

function lineKey(categoryId: string, itemName: string) {
  return `${categoryId}::${itemName}`
}

export function MenuPage({ variant = 'public' }: MenuPageProps) {
  const staff = variant === 'staff'
  useDocumentTitle(staff ? 'Cafe Turgutlu — Menü (yönetim)' : 'Cafe Turgutlu — Menü')
  const { masa, setMasa, hasMasa } = useMasaNumber()
  const [cart, setCart] = useState<Record<string, OrderLine>>({})
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  )

  const cartLines = useMemo(() => Object.values(cart).filter((l) => l.qty > 0), [cart])
  const cartTotal = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.price * l.qty, 0),
    [cartLines],
  )

  const addOne = useCallback((categoryId: string, name: string, price: number) => {
    const key = lineKey(categoryId, name)
    setFeedback(null)
    setCart((prev) => {
      const cur = prev[key]
      const qty = (cur?.qty ?? 0) + 1
      return { ...prev, [key]: { key, name, price, qty } }
    })
  }, [])

  const removeOne = useCallback((key: string) => {
    setFeedback(null)
    setCart((prev) => {
      const cur = prev[key]
      if (!cur) return prev
      const qty = cur.qty - 1
      if (qty <= 0) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: { ...cur, qty } }
    })
  }, [])

  const handleSubmit = async () => {
    if (!hasMasa || masa == null) {
      setFeedback({
        type: 'err',
        text: 'Önce masanızı seçin veya masanıza özel QR kodu okutun.',
      })
      return
    }
    if (cartLines.length === 0) {
      setFeedback({ type: 'err', text: 'Sepetiniz boş.' })
      return
    }
    setSubmitting(true)
    setFeedback(null)
    try {
      await submitOrder({
        tableNumber: masa,
        lines: cartLines,
        totalTry: cartTotal,
      })
      setCart({})
      setFeedback({
        type: 'ok',
        text: `Siparişiniz alındı (Masa ${masa}). Afiyet olsun!`,
      })
    } catch (e) {
      setFeedback({
        type: 'err',
        text: e instanceof Error ? e.message : 'Sipariş gönderilemedi.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={cn(styles.page, staff && styles.staff)}>
      {!staff ? (
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <span className={styles.brand}>Cafe Turgutlu</span>
            <div className={styles.headerMeta}>
              {hasMasa ? (
                <span className={styles.masaBadge}>Masa {masa}</span>
              ) : (
                <span className={styles.masaWarn}>Masa seçilmedi</span>
              )}
            </div>
          </div>
        </header>
      ) : (
        <div className={styles.staffToolbar}>
          <Link to="/home" className={styles.backLink}>
            ← Masalara dön
          </Link>
          <div className={styles.staffToolbarMeta}>
            {hasMasa ? (
              <span className={styles.masaBadge}>Masa {masa}</span>
            ) : (
              <span className={styles.masaWarn}>Masa seçilmedi</span>
            )}
          </div>
        </div>
      )}

      <main className={styles.main}>
        <h1 className={styles.title}>Menü</h1>
        <p className={styles.subtitle}>Yiyecek ve içeceklerimiz</p>

        <div className={styles.masaRow}>
          <label htmlFor="masa-select" className={styles.masaLabel}>
            Masa numarası (QR yoksa)
          </label>
          <select
            id="masa-select"
            className={styles.masaSelect}
            value={masa ?? ''}
            onChange={(ev) => {
              const v = ev.target.value
              if (v === '') return
              setMasa(Number.parseInt(v, 10))
            }}
          >
            <option value="">Seçin…</option>
            {Array.from({ length: TABLE_COUNT }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Masa {n}
              </option>
            ))}
          </select>
        </div>

        {!staff ? (
          <p className={styles.qrHint}>
            QR kodları masanıza özel adresle gelir:{' '}
            <code className={styles.code}>
              …/menu?masa=<strong>3</strong>
            </code>
          </p>
        ) : null}

        {feedback ? (
          <div
            className={feedback.type === 'ok' ? styles.feedbackOk : styles.feedbackErr}
            role="status"
            aria-live="polite"
          >
            {feedback.text}
          </div>
        ) : null}

        <div className={styles.categories}>
          {MENU_CATEGORIES.map((category) => (
            <section key={category.id} aria-labelledby={`menu-${category.id}`}>
              <h2 className={styles.categoryTitle} id={`menu-${category.id}`}>
                {category.title}
              </h2>
              <ul className={styles.list}>
                {category.items.map((item) => {
                  const key = lineKey(category.id, item.name)
                  const row = cart[key]
                  const qty = row?.qty ?? 0
                  return (
                    <li
                      key={`${category.id}-${item.name}`}
                      className={styles.item}
                    >
                      <div className={styles.itemMain}>
                        <span className={styles.itemName}>{item.name}</span>
                        <span className={styles.itemPrice} aria-label="Fiyat">
                          {formatPriceTry(item.price)}
                        </span>
                      </div>
                      <div className={styles.itemActions}>
                        <button
                          type="button"
                          className={styles.qtyBtn}
                          aria-label={`${item.name} eksilt`}
                          onClick={() => removeOne(key)}
                          disabled={qty === 0}
                        >
                          −
                        </button>
                        <span className={styles.qtyVal} aria-live="polite">
                          {qty}
                        </span>
                        <button
                          type="button"
                          className={styles.qtyBtn}
                          aria-label={`${item.name} ekle`}
                          onClick={() => addOne(category.id, item.name, item.price)}
                        >
                          +
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </main>

      {!staff ? <footer className={styles.footer}>Cafe Turgutlu — Turgutlu</footer> : null}

      <div className={styles.cartBar} role="region" aria-label="Sepet">
        <div className={styles.cartInner}>
          <div className={styles.cartSummary}>
            <span className={styles.cartLabel}>Sepet</span>
            <span className={styles.cartTotal}>{formatPriceTry(cartTotal)}</span>
          </div>
          <Button
            type="button"
            disabled={submitting || cartLines.length === 0 || !hasMasa}
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Gönderiliyor…' : 'Sipariş ver'}
          </Button>
        </div>
      </div>
    </div>
  )
}
