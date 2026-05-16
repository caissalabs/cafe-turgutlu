import { useCallback, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { usePaymentHistory } from '@/hooks/usePaymentHistory'
import { formatPriceTry } from '@/constants/menu'
import { canonicalTableName } from '@/constants/tables'
import {
  aggregateHourDensity,
  aggregateProducts,
  aggregateWeekdayDensity,
  collectProductOptions,
  downloadTextFile,
  filterByPeriodPreset,
  filterByProductKeys,
  paymentHistoryToCsv,
  periodEarnings,
  type PeriodPreset,
  type ProductAgg,
  sortByPaidAt,
  sumTotalTry,
} from '@/utils/paymentHistoryAnalytics'
import styles from './PaymentHistoryPage.module.css'

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

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  all: 'Tümü',
  day: 'Bugün',
  week: 'Bu hafta',
  month: 'Bu ay',
  year: 'Bu yıl',
}

function maxHourOrders(buckets: ReturnType<typeof aggregateHourDensity>): number {
  let m = 0
  for (const b of buckets) m = Math.max(m, b.orderUnits)
  return m || 1
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

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all')
  const [sortAscending, setSortAscending] = useState(false)
  const [selectedProductKeys, setSelectedProductKeys] = useState<ReadonlySet<string>>(new Set())
  const [productRankMetric, setProductRankMetric] = useState<ProductRankMetric>('qty')

  const productOptions = useMemo(() => collectProductOptions(rows), [rows])

  const filteredByPeriod = useMemo(
    () => filterByPeriodPreset(rows, periodPreset),
    [rows, periodPreset],
  )

  const filteredRows = useMemo(
    () => filterByProductKeys(filteredByPeriod, selectedProductKeys),
    [filteredByPeriod, selectedProductKeys],
  )

  const sortedRows = useMemo(
    () => sortByPaidAt(filteredRows, sortAscending),
    [filteredRows, sortAscending],
  )

  const kpis = useMemo(() => periodEarnings(rows), [rows])
  const filteredTotal = useMemo(() => sumTotalTry(filteredRows), [filteredRows])

  const hourBuckets = useMemo(() => aggregateHourDensity(filteredRows), [filteredRows])
  const weekdayBuckets = useMemo(() => aggregateWeekdayDensity(filteredRows), [filteredRows])

  const rankedProducts = useMemo(() => {
    const list = aggregateProducts(filteredRows)
    const metric =
      productRankMetric === 'qty'
        ? (p: ProductAgg) => p.qty
        : (p: ProductAgg) => p.revenue
    const sortedDesc = [...list].sort((a, b) => metric(b) - metric(a))
    const sortedAsc = [...list].sort((a, b) => metric(a) - metric(b))
    const top = sortedDesc.slice(0, 10)
    const bottom = sortedAsc.slice(0, 10)
    return { top, bottom, empty: list.length === 0 }
  }, [filteredRows, productRankMetric])

  const hourMax = maxHourOrders(hourBuckets)
  const weekdayMax = maxWeekdayOrders(weekdayBuckets)

  const toggleProductKey = useCallback((key: string) => {
    setSelectedProductKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const clearProductFilter = useCallback(() => {
    setSelectedProductKeys(new Set())
  }, [])

  const exportCsv = useCallback(() => {
    const csv = paymentHistoryToCsv(sortedRows)
    const d = new Date()
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    downloadTextFile(`odeme-gecmisi_${stamp}.csv`, csv, 'text/csv;charset=utf-8')
  }, [sortedRows])

  const productFilterActive = selectedProductKeys.size > 0

  return (
    <section className={styles.stack}>
      <h1 className={styles.pageTitleSr}>Ödeme geçmişi</h1>
      <h2 className={styles.heading}>Ödeme geçmişi</h2>
      <p className={styles.intro}>
        Masada <strong>Ödeme Alındı</strong> ile kapattığınız hesaplar burada listelenir. Aşağıdaki özet ve grafikler{' '}
        <strong>seçtiğiniz dönem ve ürün filtresine</strong> göre hesaplanır; günlük / haftalık / aylık / yıllık kazanç
        kartları tüm kayıtlara göredir.
      </p>

      {error ? (
        <p className={styles.err} role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className={styles.loading}>Yükleniyor…</p> : null}

      {!loading && rows.length > 0 ? (
        <>
          <section className={styles.kpiGrid} aria-label="Kazanç özeti">
            <article className={styles.kpiCard}>
              <p className={styles.kpiLabel}>Günlük kazanç</p>
              <p className={styles.kpiValue}>{formatPriceTry(kpis.day)}</p>
              <p className={styles.kpiHint}>Bugün (yerel saat)</p>
            </article>
            <article className={styles.kpiCard}>
              <p className={styles.kpiLabel}>Haftalık kazanç</p>
              <p className={styles.kpiValue}>{formatPriceTry(kpis.week)}</p>
              <p className={styles.kpiHint}>Pazartesi başlangıçlı hafta</p>
            </article>
            <article className={styles.kpiCard}>
              <p className={styles.kpiLabel}>Aylık kazanç</p>
              <p className={styles.kpiValue}>{formatPriceTry(kpis.month)}</p>
              <p className={styles.kpiHint}>Bu takvim ayı</p>
            </article>
            <article className={styles.kpiCard}>
              <p className={styles.kpiLabel}>Yıllık kazanç</p>
              <p className={styles.kpiValue}>{formatPriceTry(kpis.year)}</p>
              <p className={styles.kpiHint}>Bu takvim yılı</p>
            </article>
          </section>

          <div className={styles.toolbar}>
            <div className={styles.toolGroup}>
              <span className={styles.toolLabel} id="period-label">
                Dönem
              </span>
              <div className={styles.segmentRow} role="group" aria-labelledby="period-label">
                {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={periodPreset === key ? styles.segmentActive : styles.segment}
                    onClick={() => setPeriodPreset(key)}
                  >
                    {PERIOD_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.toolGroup}>
              <label className={styles.toolLabel} htmlFor="sort-paid">
                Tarihe göre sıra
              </label>
              <select
                id="sort-paid"
                className={styles.select}
                value={sortAscending ? 'asc' : 'desc'}
                onChange={(e) => setSortAscending(e.target.value === 'asc')}
              >
                <option value="desc">Yeniden eskiye</option>
                <option value="asc">Eskiden yeniye</option>
              </select>
            </div>

            <div className={styles.toolGroup}>
              <label className={styles.toolLabel} htmlFor="product-rank-metric">
                Ürün sıralaması
              </label>
              <select
                id="product-rank-metric"
                className={styles.select}
                value={productRankMetric}
                onChange={(e) => setProductRankMetric(e.target.value as ProductRankMetric)}
              >
                <option value="qty">Satış adedi</option>
                <option value="revenue">Ciro</option>
              </select>
            </div>

            <div className={styles.toolActions}>
              <button type="button" className={styles.exportBtn} onClick={exportCsv}>
                Excel (CSV) indir
              </button>
            </div>
          </div>

          <details className={styles.productFilter}>
            <summary className={styles.productFilterSummary}>
              Ürün filtresi
              {productFilterActive ? (
                <span className={styles.filterBadge}>{selectedProductKeys.size} seçili</span>
              ) : null}
            </summary>
            <p className={styles.productFilterHint}>
              Hiç seçim yoksa tüm ürünler dahildir. Seçtiğiniz ürünlerden <strong>en az biri</strong> geçen ödemeler
              listelenir.
            </p>
            {productOptions.length === 0 ? (
              <p className={styles.muted}>Ürün satırı yok.</p>
            ) : (
              <>
                <div className={styles.productChips}>
                  {productOptions.map((p) => {
                    const on = selectedProductKeys.has(p.key)
                    return (
                      <label key={p.key} className={on ? styles.chipOn : styles.chip}>
                        <input
                          type="checkbox"
                          className={styles.chipInput}
                          checked={on}
                          onChange={() => toggleProductKey(p.key)}
                        />
                        <span>{p.name}</span>
                      </label>
                    )
                  })}
                </div>
                {productFilterActive ? (
                  <button type="button" className={styles.clearFilterBtn} onClick={clearProductFilter}>
                    Ürün seçimini temizle
                  </button>
                ) : null}
              </>
            )}
          </details>

          <p className={styles.rangeSummary}>
            Filtrelenen dönem tutarı: <strong>{formatPriceTry(filteredTotal)}</strong> ·{' '}
            <span className={styles.muted}>
              {sortedRows.length} ödeme kaydı {productFilterActive ? '(ürün filtresi açık)' : ''}
            </span>
          </p>

          <section className={styles.statsSection} aria-label="İstatistikler">
            <h3 className={styles.statsHeading}>Yoğunluk — saat</h3>
            <p className={styles.statsLead}>Ödemelerdeki sipariş adedine göre (aynı saatte birden fazla hesap kapanışı toplanır).</p>
            <ul className={styles.barList}>
              {hourBuckets.map((b) => (
                <li key={b.hour} className={styles.barRow}>
                  <span className={styles.barLabel}>
                    {String(b.hour).padStart(2, '0')}:00
                  </span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${(b.orderUnits / hourMax) * 100}%` }}
                    />
                  </div>
                  <span className={styles.barValue}>{b.orderUnits}</span>
                </li>
              ))}
            </ul>

            <h3 className={styles.statsHeading}>Yoğunluk — haftanın günü</h3>
            <ul className={styles.weekBarList}>
              {weekdayBuckets.map((b) => (
                <li key={b.weekdayIndex} className={styles.barRow}>
                  <span className={styles.barLabel}>{b.label}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFillAlt}
                      style={{ width: `${(b.orderUnits / weekdayMax) * 100}%` }}
                    />
                  </div>
                  <span className={styles.barValue}>{b.orderUnits}</span>
                </li>
              ))}
            </ul>

            <div className={styles.productRankGrid}>
              <div>
                <h3 className={styles.statsHeading}>En çok tercih edilenler</h3>
                {rankedProducts.empty ? (
                  <p className={styles.muted}>Veri yok.</p>
                ) : (
                  <ol className={styles.rankList}>
                    {rankedProducts.top.map((p, i) => (
                      <li key={p.key} className={styles.rankItem}>
                        <span className={styles.rankNum}>{i + 1}</span>
                        <span className={styles.rankName}>{p.name}</span>
                        <span className={styles.rankMeta}>
                          {productRankMetric === 'qty' ? `${p.qty} adet` : formatPriceTry(p.revenue)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <div>
                <h3 className={styles.statsHeading}>En az tercih edilenler</h3>
                {rankedProducts.empty ? (
                  <p className={styles.muted}>Veri yok.</p>
                ) : (
                  <ol className={styles.rankList}>
                    {rankedProducts.bottom.map((p, i) => (
                      <li key={p.key} className={styles.rankItem}>
                        <span className={styles.rankNum}>{i + 1}</span>
                        <span className={styles.rankName}>{p.name}</span>
                        <span className={styles.rankMeta}>
                          {productRankMetric === 'qty' ? `${p.qty} adet` : formatPriceTry(p.revenue)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}

      {!loading && rows.length === 0 ? (
        <p className={styles.empty}>Henüz kayıtlı ödeme yok.</p>
      ) : null}

      {!loading && sortedRows.length === 0 && rows.length > 0 ? (
        <p className={styles.empty}>Seçilen filtrelere uyan ödeme yok.</p>
      ) : null}

      {!loading && sortedRows.length > 0 ? (
        <ul className={styles.list} aria-label="Ödemeler">
          {sortedRows.map((r) => {
            const label =
              r.tableDisplayName?.trim() ||
              canonicalTableName(r.tableNumber)
            return (
              <li key={r.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <p className={styles.cardTitle}>{label}</p>
                    <p className={styles.cardMeta}>
                      {formatPaidAt(r.paidAt)} · {r.orderCount} sipariş
                    </p>
                  </div>
                  <span className={styles.total}>{formatPriceTry(r.totalTry)}</span>
                </div>
                <ul className={styles.lines}>
                  {r.lines.map((line) => (
                    <li key={`${r.id}-${line.key}`} className={styles.line}>
                      <span className={styles.lineName}>{line.name}</span>
                      <span className={styles.lineQty}>×{line.qty}</span>
                      <span className={styles.lineSum}>
                        {formatPriceTry(line.price * line.qty)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
