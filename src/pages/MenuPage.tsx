import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { formatPriceTry } from '@/constants/menu'
import { CAFE_TABLES, type CafeTable, canonicalTableName, tableDisplayLabel } from '@/constants/tables'
import { useAuth } from '@/hooks/useAuth'
import { clearMasaSession, useMasaNumber } from '@/hooks/useMasaNumber'
import { useCafeMenu } from '@/hooks/useCafeMenu'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { usePublicBusinessId } from '@/hooks/usePublicBusinessId'
import { fetchTableNames } from '@/services/tableRepository'
import { fetchOrdersByTable, submitOrder } from '@/services/orderRepository'
import type { CafeOrder, OrderLine } from '@/types/order'
import { cn } from '@/utils/cn'
import styles from './MenuPage.module.css'

export type MenuPageProps = {
  variant?: 'public' | 'staff'
}

type Step = 'loading' | 'existing-check' | 'menu' | 'cart'

/** Müşteri menüsü: tek satır, sade ekran */
function PublicStatusLine({ text }: { text: string }) {
  return (
    <div className={styles.publicMinimal} role="status">
      <p className={styles.publicMinimalMessage}>{text}</p>
    </div>
  )
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

export function MenuPage({ variant = 'public' }: MenuPageProps) {
  const staff = variant === 'staff'
  const navigate = useNavigate()
  const { businessId: authBusinessId } = useAuth()
  const { businessId: publicBusinessId, resolving: publicBizResolving, error: publicBizError } =
    usePublicBusinessId()
  const menuBusinessId = staff ? authBusinessId : publicBusinessId

  const masaOpts = staff ? undefined : { source: 'url-only' as const }
  const { masa, setMasa, hasMasa } = useMasaNumber(masaOpts)

  useDocumentTitle(staff ? 'Cafe Turgutlu — Menü (yönetim)' : 'Cafe Turgutlu — Menü')

  const {
    categories: menuCategories,
    loading: menuLoading,
    isConfigured: menuConfigured,
    error: menuFetchError,
  } = useCafeMenu(menuBusinessId)

  /* ── Personel: masa listesi ── */
  const [staffTables, setStaffTables] = useState<CafeTable[]>(() => [...CAFE_TABLES])
  useEffect(() => {
    if (!staff || !authBusinessId) return
    void fetchTableNames(authBusinessId).then((rows) => {
      if (rows.length > 0) {
        setStaffTables(
          rows.map((r) => ({
            id: r.id,
            name: canonicalTableName(r.id),
            nickname: r.nickname,
            lastOrderAttentionClearedAt: r.lastOrderAttentionClearedAt,
          })),
        )
      }
    })
  }, [staff, authBusinessId])

  /* ── Adım ── */
  const [step, setStep] = useState<Step>(staff ? 'menu' : 'loading')
  const [existingOrders, setExistingOrders] = useState<CafeOrder[]>([])

  /* Müşteri: masa belli olunca mevcut sipariş kontrolü */
  useEffect(() => {
    if (staff || !hasMasa || masa == null || !menuBusinessId) return
    setStep('loading')
    fetchOrdersByTable(menuBusinessId, masa)
      .then((orders) => {
        if (orders.length > 0) {
          setExistingOrders(orders)
          setStep('existing-check')
        } else {
          setStep('menu')
        }
      })
      .catch(() => setStep('menu'))
  }, [staff, hasMasa, masa, menuBusinessId])

  /* ── Sepet ── */
  const [cart, setCart] = useState<Record<string, OrderLine>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const cartLines = useMemo(() => Object.values(cart).filter((l) => l.qty > 0), [cart])
  const cartTotal = useMemo(() => cartLines.reduce((s, l) => s + l.price * l.qty, 0), [cartLines])
  const cartItemCount = useMemo(() => cartLines.reduce((s, l) => s + l.qty, 0), [cartLines])

  const addOne = useCallback((itemId: string, name: string, price: number) => {
    setCart((prev) => {
      const cur = prev[itemId]
      return {
        ...prev,
        [itemId]: { key: itemId, name, price, qty: (cur?.qty ?? 0) + 1 },
      }
    })
  }, [])

  const removeOne = useCallback((key: string) => {
    setCart((prev) => {
      const cur = prev[key]
      if (!cur) return prev
      const qty = cur.qty - 1
      if (qty <= 0) { const next = { ...prev }; delete next[key]; return next }
      return { ...prev, [key]: { ...cur, qty } }
    })
  }, [])

  const handleSubmit = async () => {
    if (!menuBusinessId || !hasMasa || masa == null || cartLines.length === 0) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitOrder(menuBusinessId, { tableNumber: masa, lines: cartLines, totalTry: cartTotal })
      setCart({})
      if (!staff) {
        clearMasaSession()
        navigate('/menu/tamamlandi', { replace: true })
      } else {
        setStep('menu')
        setCart({})
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Sipariş gönderilemedi.')
    } finally {
      setSubmitting(false)
    }
  }

  if (staff && !authBusinessId) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <p className={styles.loadingText}>Oturum yükleniyor…</p>
        </main>
      </div>
    )
  }

  if (!staff) {
    if (publicBizResolving) {
      return <PublicStatusLine text="Yükleniyor…" />
    }
    if (publicBizError || !menuBusinessId) {
      return <PublicStatusLine text="Link geçersiz." />
    }
    if (!menuLoading && (!menuConfigured || menuFetchError)) {
      return <PublicStatusLine text="Şu anda bu işletmenin menüsü aktif değil." />
    }
  }

  /* ── QR gate (masa yok) ── */
  if (!staff && !hasMasa) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <span className={styles.brand}>Cafe Turgutlu</span>
          </div>
        </header>
        <main className={styles.main}>
          <div className={styles.qrGate}>
            <h1 className={styles.title}>Menü</h1>
            <p className={styles.qrGateText}>
              Sipariş vermek için <strong>masanızdaki QR kodu</strong> okutmanız gerekir.
            </p>
          </div>
        </main>
        <footer className={styles.footer}>Cafe Turgutlu — Turgutlu</footer>
      </div>
    )
  }

  /* ── Yükleniyor ── */
  if (!staff && step === 'loading') {
    return <PublicStatusLine text="Yükleniyor…" />
  }

  /* ── Mevcut sipariş kontrolü ── */
  if (!staff && step === 'existing-check') {
    const total = existingOrders.reduce((s, o) => s + o.totalTry, 0)
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <span className={styles.brand}>Cafe Turgutlu</span>
            <span className={styles.masaBadge}>Masa {masa}</span>
          </div>
        </header>
        <main className={styles.main}>
          <div className={styles.existingWrap}>
            <h1 className={styles.existingTitle}>Bu masada açık sipariş var</h1>
            <p className={styles.existingSubtitle}>Bu siparişler size mi ait?</p>

            <div className={styles.existingOrders}>
              {existingOrders.map((o) => (
                <div key={o.id} className={styles.existingOrder}>
                  <div className={styles.existingOrderTop}>
                    <time className={styles.existingTime}>{formatWhen(o.createdAt)}</time>
                    <span className={styles.existingSum}>{formatPriceTry(o.totalTry)}</span>
                  </div>
                  <ul className={styles.existingLines}>
                    {o.lines.map((l) => (
                      <li key={l.key} className={styles.existingLine}>
                        <span>{l.name} <span className={styles.existingQty}>×{l.qty}</span></span>
                        <span>{formatPriceTry(l.price * l.qty)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className={styles.existingTotal}>
                <span>Toplam</span>
                <span>{formatPriceTry(total)}</span>
              </div>
            </div>

            <div className={styles.existingActions}>
              <button
                type="button"
                className={styles.existingYes}
                onClick={() => setStep('menu')}
              >
                Evet, benim — menüye geç
              </button>
              <button
                type="button"
                className={styles.existingNo}
                onClick={() => setStep('menu')}
              >
                Hayır, yeni sipariş ver
              </button>
            </div>
          </div>
        </main>
        <footer className={styles.footer}>Cafe Turgutlu — Turgutlu</footer>
      </div>
    )
  }

  /* ── Sepet adımı ── */
  if (step === 'cart') {
    return (
      <div className={cn(styles.page, staff && styles.staff)}>
        {!staff ? (
          <header className={styles.header}>
            <div className={styles.headerInner}>
              <button type="button" className={styles.backBtn} onClick={() => setStep('menu')}>
                ← Menüye dön
              </button>
              <span className={styles.masaBadge}>Masa {masa}</span>
            </div>
          </header>
        ) : (
          <div className={styles.staffToolbar}>
            <button type="button" className={styles.backLink} onClick={() => setStep('menu')}>
              ← Menüye dön
            </button>
          </div>
        )}

        <main className={styles.main}>
          <h1 className={styles.title}>Sepetiniz</h1>

          {cartLines.length === 0 ? (
            <p className={styles.cartEmpty}>Sepetiniz boş.</p>
          ) : (
            <ul className={styles.cartList}>
              {cartLines.map((line) => (
                <li key={line.key} className={styles.cartItem}>
                  <div className={styles.cartItemMain}>
                    <span className={styles.cartItemName}>{line.name}</span>
                    <span className={styles.cartItemPrice}>{formatPriceTry(line.price * line.qty)}</span>
                  </div>
                  <div className={styles.itemActions}>
                    <button
                      type="button"
                      className={styles.qtyBtn}
                      onClick={() => removeOne(line.key)}
                    >
                      −
                    </button>
                    <span className={styles.qtyVal}>{line.qty}</span>
                    <button
                      type="button"
                      className={styles.qtyBtn}
                      onClick={() => addOne(line.key, line.name, line.price)}
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className={styles.cartSummaryCard}>
            <span className={styles.cartSummaryLabel}>Toplam</span>
            <span className={styles.cartSummaryTotal}>{formatPriceTry(cartTotal)}</span>
          </div>

          {submitError && (
            <p className={styles.submitError} role="alert">{submitError}</p>
          )}
        </main>

        {!staff ? <footer className={styles.footer}>Cafe Turgutlu — Turgutlu</footer> : null}

        <div className={styles.cartBar} role="region" aria-label="Sipariş ver">
          <div className={styles.cartInner}>
            <div className={styles.cartSummary}>
              <span className={styles.cartLabel}>{cartItemCount} ürün</span>
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

  /* ── Menü adımı ── */
  return (
    <div className={cn(styles.page, staff && styles.staff)}>
      {!staff ? (
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <span className={styles.brand}>Cafe Turgutlu</span>
            <span className={styles.masaBadge}>Masa {masa}</span>
          </div>
        </header>
      ) : (
        <div className={styles.staffToolbar}>
          <Link to="/home/menu" className={styles.backLink}>
            ← Menü yönetimine dön
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
        <p className={styles.subtitle}>
          {menuConfigured ? 'Ürünlerimiz' : staff ? 'Menü henüz yapılandırılmadı' : 'Menü hazırlanıyor'}
        </p>

        {staff && menuFetchError ? (
          <p className={styles.submitError} role="alert">
            {menuFetchError}
          </p>
        ) : null}

        {menuLoading ? <p className={styles.loadingText}>Menü yükleniyor…</p> : null}

        {staff && !menuLoading && !menuConfigured ? (
          <div className={styles.menuEmpty}>
            <p>Müşteri menüsünde gösterilecek ürün yok. Önce menünüzü oluşturun.</p>
            <Link to="/home/menu" className={styles.menuEmptyLink}>
              Menüyü ayarla
            </Link>
          </div>
        ) : null}

        {!menuLoading && menuConfigured ? (
          <>
            {staff ? (
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
                  {staffTables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {tableDisplayLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className={styles.categories}>
              {menuCategories.map((category) => (
                <section key={category.id} aria-labelledby={`menu-${category.id}`}>
                  <h2 className={styles.categoryTitle} id={`menu-${category.id}`}>
                    {category.title}
                  </h2>
                  <ul className={styles.list}>
                    {category.items.map((item) => {
                      const qty = cart[item.id]?.qty ?? 0
                      return (
                        <li key={item.id} className={styles.item}>
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className={styles.itemThumb}
                              width={64}
                              height={64}
                            />
                          ) : (
                            <div className={styles.itemThumbPh} aria-hidden />
                          )}
                          <div className={styles.itemInfo}>
                            <div className={styles.itemMain}>
                              <span className={styles.itemName}>{item.name}</span>
                              <span className={styles.itemPrice}>{formatPriceTry(item.price)}</span>
                            </div>
                            {item.description.trim() ? (
                              <p className={styles.itemDesc}>{item.description}</p>
                            ) : null}
                            {item.allergens.length > 0 ? (
                              <ul className={styles.allergenList}>
                                {item.allergens.map((a) => (
                                  <li key={a} className={styles.allergenTag}>
                                    {a}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                          <div className={styles.itemActions}>
                            <button
                              type="button"
                              className={styles.qtyBtn}
                              aria-label={`${item.name} eksilt`}
                              onClick={() => removeOne(item.id)}
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
                              onClick={() => addOne(item.id, item.name, item.price)}
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
          </>
        ) : null}
      </main>

      {!staff ? <footer className={styles.footer}>Cafe Turgutlu — Turgutlu</footer> : null}

      {/* Alt bar: boşsa "Sepet boş", doluysa "Sepete git (N ürün)" */}
      <div className={styles.cartBar} role="region" aria-label="Sepet">
        <div className={styles.cartInner}>
          <div className={styles.cartSummary}>
            <span className={styles.cartLabel}>
              {cartItemCount > 0 ? `${cartItemCount} ürün seçildi` : 'Sepet boş'}
            </span>
            {cartTotal > 0 && <span className={styles.cartTotal}>{formatPriceTry(cartTotal)}</span>}
          </div>
          <Button
            type="button"
            disabled={cartLines.length === 0 || !hasMasa || !menuConfigured}
            onClick={() => setStep('cart')}
          >
            Sepete git
          </Button>
        </div>
      </div>
    </div>
  )
}
