import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { formatPriceTry } from '@/constants/menu'
import type { CafeMenuCategory, CafeMenuItem } from '@/types/menu'
import { cn } from '@/utils/cn'
import styles from './CustomerMenuM3.module.css'

export type CustomerMenuM3Props = {
  brandLabel: string
  masa?: number | null
  subtitle: string
  categories: CafeMenuCategory[]
  loading: boolean
  staff: boolean
  configured: boolean
  staffBanner?: ReactNode

  qtyForItem: (itemId: string) => number
  onAdd: (item: CafeMenuItem) => void
  onRemove: (itemId: string) => void

  cartItemCount: number
  cartTotalTry: number
  checkoutDisabled: boolean
  checkoutLabel?: string
  onCheckout: () => void

  /** Panel önizleme: yapılandırılmadı blokları */
  staffEmpty?: ReactNode
  /** API / bağlantı hatası banner */
  errorText?: string | null
}

/** Referans tasarımla hizalı müşteri menü düzeni (Material 3 + Inter) */
export function CustomerMenuM3({
  brandLabel,
  masa,
  subtitle,
  categories,
  loading,
  staff,
  configured,
  staffBanner,
  qtyForItem,
  onAdd,
  onRemove,
  cartItemCount,
  cartTotalTry,
  checkoutDisabled,
  checkoutLabel = 'Sepete Git',
  onCheckout,
  staffEmpty,
  errorText,
}: CustomerMenuM3Props) {
  const detailHeadingId = useId()
  const overflowBeforeModal = useRef<string | null>(null)
  const [phase, setPhase] = useState<'welcome' | 'browse'>('welcome')
  const [activeCatId, setActiveCatId] = useState<string | null>(() => categories[0]?.id ?? null)
  const [detailItem, setDetailItem] = useState<CafeMenuItem | null>(null)

  const closeDetail = useCallback(() => setDetailItem(null), [])

  useEffect(() => {
    if (categories.length === 0) setPhase('welcome')
  }, [categories.length])

  useEffect(() => {
    if (phase === 'welcome') {
      closeDetail()
      window.scrollTo(0, 0)
    }
  }, [phase, closeDetail])

  useEffect(() => {
    if (!detailItem) return
    overflowBeforeModal.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflowBeforeModal.current ?? ''
    }
  }, [detailItem])

  useEffect(() => {
    if (!detailItem) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDetail()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailItem, closeDetail])

  useEffect(() => {
    if (categories.length === 0) {
      setActiveCatId(null)
      return
    }
    setActiveCatId((cur) => {
      if (cur != null && categories.some((c) => c.id === cur)) return cur
      return categories[0]?.id ?? null
    })
  }, [categories])

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === activeCatId) ?? null,
    [categories, activeCatId],
  )

  const detailCategoryTitle = useMemo(() => {
    if (!detailItem) return null
    return categories.find((c) => c.id === detailItem.categoryId)?.title ?? null
  }, [detailItem, categories])

  const modalQty = detailItem ? qtyForItem(detailItem.id) : 0

  const bottomCaps =
    cartItemCount > 0 ? `${cartItemCount} ÜRÜN` : 'SEPET BOŞ'

  const renderItemCard = (item: CafeMenuItem) => {
    const qty = qtyForItem(item.id)
    const inner = (
      <>
        <div className={styles.thumbWrap}>
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" className={styles.thumbImg} aria-hidden />
          ) : (
            <div className={styles.thumbPlaceholder} aria-hidden />
          )}
        </div>
        <div className={styles.body}>
          <div className={styles.topRow}>
            <div className={styles.textCol}>
              <h4 className={styles.productName}>{item.name}</h4>
              {item.description.trim() ? (
                <p className={styles.desc}>{item.description}</p>
              ) : null}
              {item.allergens.length > 0 ? (
                <div className={styles.tagRow}>
                  {item.allergens.map((tag, ai) => (
                    <span
                      key={tag}
                      className={
                        ai % 2 === 0 ? styles.tagAllergenWarn : styles.tagAllergenMuted
                      }
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <span className={styles.price}>{formatPriceTry(item.price)}</span>
          </div>
        </div>
      </>
    )

    return (
      <article key={item.id} className={styles.card}>
        <button
          type="button"
          className={styles.cardTapArea}
          onClick={() => setDetailItem(item)}
          aria-haspopup="dialog"
          aria-label={`${item.name}: detay`}
        >
          {inner}
        </button>
        {!staff ? (
          <div className={styles.cardQtyAside}>
            <div className={styles.actionsRow}>
              <div className={styles.qtyShell}>
                <button
                  type="button"
                  className={styles.qtyMicro}
                  aria-label={`${item.name} eksilt`}
                  disabled={qty === 0}
                  onClick={() => onRemove(item.id)}
                >
                  <span className={cn(styles.materialIcon, styles.materialIconMd)}>remove</span>
                </button>
                <span className={styles.qtyReadout} aria-live="polite">
                  {qty}
                </span>
                <button
                  type="button"
                  className={cn(styles.qtyMicro, styles.qtyMicroPlus)}
                  aria-label={`${item.name} ekle`}
                  onClick={() => onAdd(item)}
                >
                  <span className={cn(styles.materialIcon, styles.materialIconMd)}>add</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </article>
    )
  }

  return (
    <>
      {staffBanner}

      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerRow}>
            <div className={styles.brandZone}>
              <span
                className={cn(styles.materialIcon, styles.materialIconHeader)}
                aria-hidden
              >
                restaurant
              </span>
              <h1 className={styles.brandTitle} title={brandLabel}>
                {brandLabel}
              </h1>
            </div>
            {masa != null ? (
              <div className={styles.masaPill}>
                <span className={styles.masaText}>Masa {masa}</span>
              </div>
            ) : null}
          </div>
        </header>

        <main className={styles.main}>
          {errorText ? (
            <p className={styles.inlineError} role="alert">
              {errorText}
            </p>
          ) : null}

          {staff && !configured && !loading && staffEmpty ? (
            <div className={styles.staffEmptyWrap}>{staffEmpty}</div>
          ) : null}

          {loading && categories.length === 0 ? (
            <p className={styles.loader} role="status">
              Menü yükleniyor…
            </p>
          ) : null}

          {configured && categories.length === 0 && !staff ? (
            <p className={styles.emptyCategory}>Bu menüde henüz ürün yok.</p>
          ) : null}

          {configured && categories.length > 0 && phase === 'welcome' ? (
            <section className={styles.welcomeBlock} aria-labelledby="welcome-main-heading">
              <h2 className={styles.welcomeTitle} id="welcome-main-heading">
                Hoş geldiniz!
              </h2>
              <div className={styles.welcomeGrid} aria-labelledby="welcome-main-heading">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={styles.welcomeCatBtn}
                    onClick={() => {
                      setActiveCatId(c.id)
                      setPhase('browse')
                    }}
                  >
                    <span className={styles.welcomeCatTextCol}>
                      <span className={styles.welcomeCatTitle}>{c.title}</span>
                      <span className={styles.welcomeCatMeta}>
                        {c.items.length} ürün
                      </span>
                    </span>
                    <span className={styles.welcomeCatChevron} aria-hidden>
                      <span className={styles.materialIcon}>chevron_forward</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {configured && categories.length > 0 && phase === 'browse' ? (
            <>
              <button
                type="button"
                className={styles.browseBack}
                onClick={() => setPhase('welcome')}
              >
                <span className={cn(styles.materialIcon)} aria-hidden>
                  arrow_back
                </span>
                Kategori seçimi
              </button>

              <section className={styles.hero} aria-label="Menü girişi">
                <h2 className={styles.heroTitle}>Menü</h2>
                <p className={styles.heroSub}>{subtitle}</p>
              </section>

              <nav className={styles.catNav} aria-label="Kategoriler">
                {categories.map((c) => {
                  const selected = c.id === activeCatId
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={cn(
                        styles.catBtn,
                        selected ? styles.catBtnActive : styles.catBtnInactive,
                      )}
                      onClick={() => setActiveCatId(c.id)}
                      aria-current={selected ? 'true' : undefined}
                    >
                      {c.title}
                    </button>
                  )
                })}
              </nav>

              <div className={styles.categoryHead}>
                <h3 className={styles.categoryHeading}>{activeCategory?.title ?? '—'}</h3>
              </div>

              <div className={styles.products}>
                {(activeCategory?.items ?? []).length === 0 ? (
                  <p className={styles.emptyCategory}>Bu kategoride ürün yok.</p>
                ) : null}
                {(activeCategory?.items ?? []).map((item) => renderItemCard(item))}
              </div>
            </>
          ) : null}
        </main>

        {!staff ? (
          <footer className={styles.bottomBar} role="region" aria-label="Sepet özeti">
            <div className={styles.bottomLeft}>
              <div className={styles.cartCircle}>
                <span className={cn(styles.materialIcon, styles.materialIconCart)} aria-hidden>
                  shopping_cart
                </span>
              </div>
              <div className={styles.cartTexts}>
                <span className={styles.cartCaps}>{bottomCaps}</span>
                {cartTotalTry > 0 ? (
                  <span className={styles.cartSubtle}>{formatPriceTry(cartTotalTry)}</span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              className={styles.checkoutBtn}
              disabled={checkoutDisabled}
              onClick={() => onCheckout()}
            >
              <span>{checkoutLabel}</span>
              <span className={styles.materialIcon} aria-hidden>
                arrow_forward
              </span>
            </button>
          </footer>
        ) : null}
      </div>

      {detailItem ? (
        <div
          className={styles.detailOverlay}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDetail()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={detailHeadingId}
            className={styles.detailDialog}
            tabIndex={-1}
          >
            <div className={styles.detailHero}>
              {detailItem.imageUrl ? (
                <img
                  src={detailItem.imageUrl}
                  alt={detailItem.name}
                  className={styles.detailHeroImg}
                />
              ) : (
                <div className={styles.thumbPlaceholder} aria-hidden />
              )}
              <button
                type="button"
                className={styles.detailDismiss}
                onClick={closeDetail}
                aria-label="Kapat"
              >
                <span className={styles.materialIcon}>close</span>
              </button>
            </div>

            <div className={styles.detailBody}>
              {detailCategoryTitle ? (
                <p className={styles.detailCat}>{detailCategoryTitle}</p>
              ) : null}
              <h3 className={styles.detailHeading} id={detailHeadingId}>
                {detailItem.name}
              </h3>
              <p className={styles.detailPrice}>{formatPriceTry(detailItem.price)}</p>
              {detailItem.description.trim() ? (
                <p className={styles.detailDesc}>{detailItem.description}</p>
              ) : null}
              {detailItem.allergens.length > 0 ? (
                <>
                  <p className={styles.detailAllergenLead}>İçerik / uyarılar</p>
                  <div className={styles.tagRow}>
                    {detailItem.allergens.map((tag, ai) => (
                      <span
                        key={tag}
                        className={
                          ai % 2 === 0 ? styles.tagAllergenWarn : styles.tagAllergenMuted
                        }
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <div className={styles.detailFooter}>
              {!staff ? (
                <div className={styles.detailFooterQty}>
                  <div className={styles.qtyShell}>
                    <button
                      type="button"
                      className={styles.qtyMicro}
                      aria-label={`${detailItem.name} eksilt`}
                      disabled={modalQty === 0}
                      onClick={() => onRemove(detailItem.id)}
                    >
                      <span className={cn(styles.materialIcon, styles.materialIconMd)}>
                        remove
                      </span>
                    </button>
                    <span className={styles.qtyReadout} aria-live="polite">
                      {modalQty}
                    </span>
                    <button
                      type="button"
                      className={cn(styles.qtyMicro, styles.qtyMicroPlus)}
                      aria-label={`${detailItem.name} ekle`}
                      onClick={() => onAdd(detailItem)}
                    >
                      <span className={cn(styles.materialIcon, styles.materialIconMd)}>add</span>
                    </button>
                  </div>
                </div>
              ) : null}
              {staff ? (
                <button
                  type="button"
                  className={cn(styles.detailKapatBtn, styles.detailFooterWide)}
                  onClick={closeDetail}
                >
                  Kapat
                </button>
              ) : (
                <div className={styles.detailFooterActions}>
                  <button type="button" className={styles.detailKapatBtn} onClick={closeDetail}>
                    Kapat
                  </button>
                  <button
                    type="button"
                    className={styles.detailSepeteBtn}
                    aria-label={`Sepete ${detailItem.name} ekle`}
                    onClick={() => onAdd(detailItem)}
                  >
                    Sepete Ekle
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
