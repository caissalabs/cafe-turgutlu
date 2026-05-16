import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useCafeMenu } from '@/hooks/useCafeMenu'
import { usePaymentHistory } from '@/hooks/usePaymentHistory'
import { formatPriceTry } from '@/constants/menu'
import { canonicalTableName } from '@/constants/tables'
import {
  aggregateHourDensity,
  aggregateProducts,
  aggregateWeekdayDensity,
  THREE_HOUR_SLOT_LABELS,
  downloadTextFile,
  filterByPeriodPreset,
  filterLastNDays,
  filterByThreeHourSlot,
  filterPaymentSearch,
  mergeMenuWithSales,
  paymentCountsForKpis,
  paymentHistoryToCsv,
  peakHourRangeFromBuckets,
  peakWeekdayFromBuckets,
  periodEarnings,
  type ListSortMode,
  type PeriodPreset,
  type ProductAgg,
  sortPaymentRows,
  sumTotalTry,
} from '@/utils/paymentHistoryAnalytics'
import { cn } from '@/utils/cn'
import styles from './PaymentHistoryPage.module.css'

const PAGE_SIZE = 10

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  all: 'Tümü',
  day: 'Günlük',
  week: 'Haftalık',
  month: 'Aylık',
  year: 'Yıllık',
}

function formatPaidAt(iso: string): string {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return iso
  }
}

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn(styles.ms, className)} aria-hidden>
      {name}
    </span>
  )
}

function maxWeekdayOrders(buckets: ReturnType<typeof aggregateWeekdayDensity>): number {
  let m = 0
  for (const b of buckets) m = Math.max(m, b.orderUnits)
  return m || 1
}

type ProductRankMetric = 'qty' | 'revenue'

export function PaymentHistoryPage() {
  useDocumentTitle('CafeNET — Ödeme geçmişi')
  const { businessId } = useAuth()
  const { rows, loading, error } = usePaymentHistory(businessId)
  const {
    categories,
    loading: menuLoading,
    isConfigured: menuConfigured,
  } = useCafeMenu(businessId, { subscribeRealtime: false })

  const now = new Date()
  const [listPeriodPreset, setListPeriodPreset] = useState<PeriodPreset>('all')
  const [densityPeriodPreset, setDensityPeriodPreset] = useState<PeriodPreset>('all')
  const [densityThreeHourSlot, setDensityThreeHourSlot] = useState<number | null>(null)
  const [sortMode, setSortMode] = useState<ListSortMode>('date-desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [productRankMetric, setProductRankMetric] = useState<ProductRankMetric>('qty')
  const [page, setPage] = useState(1)

  const kpis = useMemo(() => periodEarnings(rows, now), [rows, now])
  const counts = useMemo(() => paymentCountsForKpis(rows, now), [rows, now])

  const listScopedRows = useMemo(
    () => filterByPeriodPreset(rows, listPeriodPreset, now),
    [rows, listPeriodPreset, now],
  )

  const densityRows = useMemo(() => {
    let base =
      densityPeriodPreset === 'all'
        ? filterLastNDays(rows, 30, now)
        : filterByPeriodPreset(rows, densityPeriodPreset, now)
    base = filterByThreeHourSlot(base, densityThreeHourSlot)
    return base
  }, [rows, densityPeriodPreset, densityThreeHourSlot, now])

  const densitySubtitle = useMemo(() => {
    const parts: string[] = []
    parts.push(
      densityPeriodPreset === 'all' ? 'Son 30 gün' : PERIOD_LABELS[densityPeriodPreset],
    )
    if (densityThreeHourSlot != null && THREE_HOUR_SLOT_LABELS[densityThreeHourSlot]) {
      parts.push(THREE_HOUR_SLOT_LABELS[densityThreeHourSlot]!)
    }
    return parts.join(' · ')
  }, [densityPeriodPreset, densityThreeHourSlot])

  const weekdayBuckets = useMemo(() => aggregateWeekdayDensity(densityRows), [densityRows])
  const hourBuckets = useMemo(() => aggregateHourDensity(densityRows), [densityRows])
  const weekdayMax = maxWeekdayOrders(weekdayBuckets)

  const peakHourLabel = useMemo(() => peakHourRangeFromBuckets(hourBuckets), [hourBuckets])
  const peakDayLabel = useMemo(() => peakWeekdayFromBuckets(weekdayBuckets), [weekdayBuckets])

  const productCatalog = useMemo(() => {
    if (menuConfigured && categories.length > 0) {
      return mergeMenuWithSales(categories, listScopedRows)
    }
    return aggregateProducts(listScopedRows)
  }, [categories, listScopedRows, menuConfigured])

  const rankedProducts = useMemo(() => {
    const metric =
      productRankMetric === 'qty'
        ? (p: ProductAgg) => p.qty
        : (p: ProductAgg) => p.revenue

    const withSales = productCatalog.filter((p) => metric(p) > 0)
    const top = [...withSales].sort((a, b) => metric(b) - metric(a)).slice(0, 8)

    const bottom = [...productCatalog]
      .sort((a, b) => {
        const ma = metric(a)
        const mb = metric(b)
        if (ma !== mb) return ma - mb
        return a.name.localeCompare(b.name, 'tr')
      })
      .slice(0, 8)

    return {
      top,
      bottom,
      empty: productCatalog.length === 0,
      usesMenu: menuConfigured && categories.length > 0,
    }
  }, [productCatalog, productRankMetric, menuConfigured, categories.length])

  const listPipeline = useMemo(() => {
    let x = [...listScopedRows]
    x = filterPaymentSearch(x, searchQuery)
    return sortPaymentRows(x, sortMode)
  }, [listScopedRows, searchQuery, sortMode])

  const filteredTotal = useMemo(() => sumTotalTry(listPipeline), [listPipeline])

  const totalPages = Math.max(1, Math.ceil(listPipeline.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return listPipeline.slice(start, start + PAGE_SIZE)
  }, [listPipeline, safePage])

  useEffect(() => {
    setPage(1)
  }, [listPeriodPreset, searchQuery, sortMode])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(now),
    [now],
  )

  const exportCsv = useCallback(() => {
    const csv = paymentHistoryToCsv(listPipeline)
    const d = new Date()
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    downloadTextFile(`odeme-gecmisi_${stamp}.csv`, csv, 'text/csv;charset=utf-8')
  }, [listPipeline])

  const rangeFrom = listPipeline.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeTo = Math.min(safePage * PAGE_SIZE, listPipeline.length)

  return (
    <section className={styles.shell}>
      <h1 className={styles.pageTitleSr}>Ödeme geçmişi</h1>

      {error ? (
        <p className={styles.err} role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className={styles.loading}>Yükleniyor…</p> : null}

      {!loading && rows.length === 0 ? (
        <p className={styles.empty}>Henüz kayıtlı ödeme yok.</p>
      ) : null}

      {!loading && rows.length > 0 ? (
        <>
          <div className={styles.sectionBlock}>
            <h2 className={styles.sectionTitle}>
              <Icon name="account_balance_wallet" className={styles.sectionTitleIcon} />
              Gelir Kalemleri
            </h2>
            <div className={styles.kpiGrid}>
              <article className={styles.kpiCard}>
                <p className={styles.kpiCardLabel}>Günlük Gelir</p>
                <div className={styles.kpiCardAmount}>{formatPriceTry(kpis.day)}</div>
                <div className={styles.kpiCardHint}>
                  Bugün, {counts.day} işlem
                </div>
              </article>
              <article className={styles.kpiCard}>
                <p className={styles.kpiCardLabel}>Haftalık Gelir</p>
                <div className={styles.kpiCardAmount}>{formatPriceTry(kpis.week)}</div>
                <div className={styles.kpiCardHint}>Son 7 gün · {counts.week} işlem</div>
              </article>
              <article className={styles.kpiCard}>
                <p className={styles.kpiCardLabel}>Aylık Gelir</p>
                <div className={styles.kpiCardAmount}>{formatPriceTry(kpis.month)}</div>
                <div className={styles.kpiCardHint}>
                  {monthTitle} · {counts.month} işlem
                </div>
              </article>
              <article className={styles.kpiCard}>
                <p className={styles.kpiCardLabel}>Yıllık Gelir</p>
                <div className={styles.kpiCardAmount}>{formatPriceTry(kpis.year)}</div>
                <div className={styles.kpiCardHint}>
                  {now.getFullYear()} yılı · {counts.year} işlem
                </div>
              </article>
            </div>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.densityCard}>
              <div className={styles.densityHead}>
                <h3 className={styles.densityTitle}>
                  <Icon name="analytics" className={styles.sectionTitleIcon} />
                  Yoğunluk Analizi
                </h3>
                <span className={styles.densityMeta}>{densitySubtitle}</span>
              </div>

              <div className={styles.densityToolbar}>
                <span className={styles.densityToolbarLabel}>Dönem</span>
                <div className={styles.densityPeriodToggle} role="group" aria-label="Yoğunluk dönemi">
                  {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={
                        densityPeriodPreset === key ? styles.densityPeriodOn : styles.densityPeriodBtn
                      }
                      onClick={() => setDensityPeriodPreset(key)}
                    >
                      {PERIOD_LABELS[key]}
                    </button>
                  ))}
                </div>
                <div className={styles.densityHourRow}>
                  <label className={styles.densityHourLabel} htmlFor="dens-slot">
                    Saat dilimi (3 saat)
                  </label>
                  <div className={styles.densityHourSelects}>
                    <select
                      id="dens-slot"
                      className={cn(styles.densitySelect, styles.densitySlotSelect)}
                      value={densityThreeHourSlot === null ? 'all' : String(densityThreeHourSlot)}
                      onChange={(e) => {
                        const v = e.target.value
                        setDensityThreeHourSlot(v === 'all' ? null : Number(v))
                      }}
                      aria-label="Üç saatlik saat dilimi"
                    >
                      <option value="all">Tümü</option>
                      {THREE_HOUR_SLOT_LABELS.map((label, i) => (
                        <option key={label} value={i}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className={styles.heatmap}>
                {weekdayBuckets.map((b) => (
                  <div key={b.weekdayIndex} className={styles.heatmapCol}>
                    <div
                      className={styles.heatmapBar}
                      style={{
                        height: `${Math.max(18, (b.orderUnits / weekdayMax) * 112)}px`,
                      }}
                    />
                    <span className={styles.heatmapDay}>{b.label}</span>
                  </div>
                ))}
              </div>
              <div className={styles.densityFoot}>
                <div className={styles.densityFootInner}>
                  <div className={styles.peakItem}>
                    <Icon name="schedule" className={styles.peakIcon} />
                    <span className={styles.peakText}>En yoğun saat: {peakHourLabel}</span>
                  </div>
                  <div className={styles.peakItem}>
                    <Icon name="event" className={styles.peakIcon} />
                    <span className={styles.peakText}>En yoğun gün: {peakDayLabel}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.sideStack}>
              <div className={styles.sideCard}>
                <div className={styles.sideCardHead}>
                  <h3 className={styles.sideCardTitle}>En Çok Tercih Edilenler</h3>
                  <select
                    className={styles.sideSelect}
                    value={productRankMetric}
                    onChange={(e) => setProductRankMetric(e.target.value as ProductRankMetric)}
                    aria-label="Ürün sıralama ölçütü"
                  >
                    <option value="qty">Adet</option>
                    <option value="revenue">Ciro</option>
                  </select>
                </div>
                <div className={styles.sideList}>
                  {menuLoading ? (
                    <p className={styles.sideEmpty}>Menü yükleniyor…</p>
                  ) : rankedProducts.empty ? (
                    <p className={styles.sideEmpty}>Veri yok.</p>
                  ) : rankedProducts.top.length === 0 ? (
                    <p className={styles.sideEmpty}>Bu dönemde satış kaydı yok.</p>
                  ) : (
                    rankedProducts.top.map((p) => (
                      <div key={p.key} className={styles.sideRow}>
                        <span className={styles.sideName}>{p.name}</span>
                        <span className={styles.sideVal}>
                          {productRankMetric === 'qty' ? `${p.qty} Adet` : formatPriceTry(p.revenue)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                {!menuConfigured && !menuLoading ? (
                  <p className={styles.sideFootnote}>
                    Menü tanımlı değil; ürünler yalnızca ödemelerde geçen kalemlerden listelenir.
                  </p>
                ) : null}
              </div>
              <div className={styles.sideCard}>
                <h3 className={cn(styles.sideCardTitle, styles.sideCardTitleDanger)}>
                  En Az Tercih Edilenler
                </h3>
                <div className={styles.sideList}>
                  {menuLoading ? (
                    <p className={styles.sideEmpty}>Menü yükleniyor…</p>
                  ) : rankedProducts.empty ? (
                    <p className={styles.sideEmpty}>Veri yok.</p>
                  ) : (
                    rankedProducts.bottom.map((p) => (
                      <div key={p.key} className={styles.sideRow}>
                        <span className={styles.sideName}>{p.name}</span>
                        <span className={styles.sideValMuted}>
                          {productRankMetric === 'qty' ? `${p.qty} Adet` : formatPriceTry(p.revenue)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                {rankedProducts.usesMenu ? (
                  <p className={styles.sideFootnote}>
                    Menüdeki tüm ürünler; satışı olmayanlar 0 adet ile en altta gösterilir.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelToolbar}>
              <div className={styles.panelToolbarTop}>
                <div className={styles.panelTitleRow}>
                  <Icon name="history" className={styles.sectionTitleIcon} />
                  <h2 className={styles.panelTitle}>İşlem Detayları</h2>
                </div>
                <button type="button" className={styles.exportBtn} onClick={exportCsv}>
                  <Icon name="description" />
                  Excel Olarak Dışa Aktar
                </button>
              </div>

              <div className={styles.panelFilters}>
                <div className={styles.searchWrap}>
                  <Icon name="search" className={styles.searchIcon} />
                  <input
                    type="search"
                    className={styles.searchInput}
                    placeholder="İşlem veya Ürün Ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="İşlem veya ürün ara"
                  />
                </div>

                <select
                  className={styles.filterSelect}
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as ListSortMode)}
                  aria-label="Sıralama"
                >
                  <option value="date-desc">Tarih: En Yeni</option>
                  <option value="date-asc">Tarih: En Eski</option>
                  <option value="amount-desc">Tutar: En Yüksek</option>
                  <option value="amount-asc">Tutar: En Düşük</option>
                </select>

                <div className={styles.periodToggle} role="group" aria-label="İşlem listesi dönemi">
                  {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={listPeriodPreset === key ? styles.periodBtnOn : styles.periodBtn}
                      onClick={() => setListPeriodPreset(key)}
                    >
                      {PERIOD_LABELS[key]}
                    </button>
                  ))}
                </div>
              </div>

              <p className={styles.summaryLine}>
                Filtrelenen tutar: <strong>{formatPriceTry(filteredTotal)}</strong>
                <span className={styles.summaryMuted}> · {listPipeline.length} kayıt</span>
              </p>
            </div>

            {listPipeline.length === 0 ? (
              <p className={styles.panelEmpty}>Seçilen filtrelere uyan işlem yok.</p>
            ) : (
              <ul className={styles.txList}>
                {pageSlice.map((r, idx) => {
                  const label =
                    r.tableDisplayName?.trim() ||
                    canonicalTableName(r.tableNumber)
                  const iconName = idx % 2 === 0 ? 'table_bar' : 'table_restaurant'
                  return (
                    <li key={r.id} className={styles.txRow}>
                      <div className={styles.txMain}>
                        <div className={styles.txLeft}>
                          <div className={styles.txAvatar}>
                            <Icon name={iconName} className={styles.txAvatarIcon} />
                          </div>
                          <div>
                            <h3 className={styles.txTitle}>{label}</h3>
                            <p className={styles.txMeta}>{formatPaidAt(r.paidAt)}</p>
                          </div>
                        </div>
                        <div className={styles.txMid}>
                          <div className={styles.txMidLabel}>Sipariş Detayı</div>
                          <div className={styles.txChips}>
                            {r.lines.map((line) => (
                              <span key={`${r.id}-${line.key}`} className={styles.lineChip}>
                                {line.name} × {line.qty}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className={styles.txRight}>
                          <div className={styles.txAmount}>{formatPriceTry(r.totalTry)}</div>
                          <div className={styles.paidBadge}>
                            <Icon name="check_circle" className={styles.msFill} />
                            Ödendi
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {listPipeline.length > 0 ? (
              <div className={styles.pagination}>
                <p className={styles.paginationInfo}>
                  Toplam {listPipeline.length} işlemin {rangeFrom}-{rangeTo} arası gösteriliyor
                </p>
                <div className={styles.paginationBtns}>
                  <button
                    type="button"
                    className={styles.pageArrow}
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Önceki sayfa"
                  >
                    <Icon name="chevron_left" />
                  </button>
                  {totalPages <= 9
                    ? Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
                        <button
                          key={pNum}
                          type="button"
                          className={pNum === safePage ? styles.pageNumOn : styles.pageNum}
                          onClick={() => setPage(pNum)}
                        >
                          {pNum}
                        </button>
                      ))
                    : (
                        <>
                          <button
                            type="button"
                            className={safePage === 1 ? styles.pageNumOn : styles.pageNum}
                            onClick={() => setPage(1)}
                          >
                            1
                          </button>
                          {safePage > 3 ? <span className={styles.pageEllipsis}>…</span> : null}
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter((pNum) => pNum > 1 && pNum < totalPages && Math.abs(pNum - safePage) <= 1)
                            .map((pNum) => (
                              <button
                                key={pNum}
                                type="button"
                                className={pNum === safePage ? styles.pageNumOn : styles.pageNum}
                                onClick={() => setPage(pNum)}
                              >
                                {pNum}
                              </button>
                            ))}
                          {safePage < totalPages - 2 ? (
                            <span className={styles.pageEllipsis}>…</span>
                          ) : null}
                          <button
                            type="button"
                            className={safePage === totalPages ? styles.pageNumOn : styles.pageNum}
                            onClick={() => setPage(totalPages)}
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                  <button
                    type="button"
                    className={styles.pageArrow}
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Sonraki sayfa"
                  >
                    <Icon name="chevron_right" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  )
}
