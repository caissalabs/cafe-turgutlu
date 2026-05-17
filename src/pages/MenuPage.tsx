import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { CustomerMenuM3 } from '@/components/CustomerMenuM3'
import deckStyles from '@/components/CustomerMenuM3.module.css'
import { formatPriceTry } from '@/constants/menu'
import { useAuth } from '@/hooks/useAuth'
import { clearMasaSession, useMasaNumber } from '@/hooks/useMasaNumber'
import { useBusinessDisplayName } from '@/hooks/useBusinessDisplayName'
import { useCafeMenu } from '@/hooks/useCafeMenu'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { usePublicBusinessId } from '@/hooks/usePublicBusinessId'
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
  const { displayName: businessBrandName } = useBusinessDisplayName(menuBusinessId)

  const brandLabel = businessBrandName?.trim() || 'CafeNET'

  const docSuffix = staff ? 'Menü (önizleme)' : 'CafeNET Menü'
  useDocumentTitle(`${brandLabel} — ${docSuffix}`)

  const { masa, hasMasa } = useMasaNumber({ source: 'url-only' })

  const {
    categories: menuCategories,
    loading: menuLoading,
    isConfigured: menuConfigured,
    error: menuFetchError,
  } = useCafeMenu(menuBusinessId)

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

  const addOne = useCallback(
    (itemId: string, name: string, price: number, imageUrl: string | null | undefined = undefined) => {
      setCart((prev) => {
        const cur = prev[itemId]
        const mergedImg =
          imageUrl !== undefined ? (imageUrl || null) : (cur?.imageUrl ?? null)
        return {
          ...prev,
          [itemId]: {
            key: itemId,
            name,
            price,
            qty: (cur?.qty ?? 0) + 1,
            imageUrl: mergedImg,
          },
        }
      })
    },
    [],
  )

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
    if (!menuLoading && menuFetchError) {
      return <PublicStatusLine text="Menü yüklenemedi. İnternetinizi kontrol edip sayfayı yenileyin." />
    }
    if (!menuLoading && !menuConfigured) {
      return <PublicStatusLine text="Şu anda bu işletmenin menüsü aktif değil." />
    }
  }

  /* ── QR gate (masa yok) ── */
  if (!staff && !hasMasa) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <span className={styles.brand} title={brandLabel}>{brandLabel}</span>
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
        <footer className={styles.footer}>CafeNET</footer>
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
            <span className={styles.brand} title={brandLabel}>{brandLabel}</span>
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
        <footer className={styles.footer}>CafeNET</footer>
      </div>
    )
  }

  /* ── Sepet adımı ── */
  if (step === 'cart' && !staff) {
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
                  {line.imageUrl ? (
                    <img src={line.imageUrl} alt="" className={styles.cartThumb} loading="lazy" />
                  ) : (
                    <div className={styles.cartThumbPh} aria-hidden />
                  )}
                  <div className={styles.cartItemBody}>
                    <div className={styles.cartItemTop}>
                      <span className={styles.cartItemName}>{line.name}</span>
                      <span className={styles.cartItemPrice}>
                        {formatPriceTry(line.price * line.qty)}
                      </span>
                    </div>
                    <div className={styles.cartItemActionsRow}>
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
                    </div>
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
    <>
      <CustomerMenuM3
        brandLabel={brandLabel}
        masa={staff ? null : masa}
        subtitle={
          staff
            ? menuConfigured
              ? 'Müşteri ekranında böyle görünür. Sipariş eklemek için Masalar’daki ⋮ menüsünü kullanın.'
              : 'Menü henüz yapılandırılmadı'
            : menuConfigured
              ? 'Ürünlerimiz'
              : 'Menü hazırlanıyor'
        }
        categories={menuCategories}
        loading={menuLoading}
        staff={staff}
        configured={menuConfigured}
        errorText={menuFetchError}
        staffBanner={
          staff ? (
            <div className={deckStyles.staffToolbar}>
              <Link to="/home/menu">← Menü yönetimine dön</Link>
            </div>
          ) : undefined
        }
        staffEmpty={
          staff ? (
            <div className={styles.menuEmpty}>
              <p>Müşteri menüsünde gösterilecek ürün yok. Önce menünüzü oluşturun.</p>
              <Link to="/home/menu" className={styles.menuEmptyLink}>
                Menüyü ayarla
              </Link>
            </div>
          ) : undefined
        }
        qtyForItem={(id) => cart[id]?.qty ?? 0}
        onAdd={(item) => void addOne(item.id, item.name, item.price, item.imageUrl)}
        onRemove={removeOne}
        cartItemCount={cartItemCount}
        cartTotalTry={cartTotal}
        checkoutDisabled={cartLines.length === 0 || !hasMasa || !menuConfigured}
        onCheckout={() => setStep('cart')}
      />
    </>
  )
}
