import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { usePaymentHistory } from '@/hooks/usePaymentHistory'
import { formatPriceTry } from '@/constants/menu'
import { canonicalTableName } from '@/constants/tables'
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

export function PaymentHistoryPage() {
  useDocumentTitle('CafeNET — Ödeme geçmişi')
  const { businessId } = useAuth()
  const { rows, loading, error } = usePaymentHistory(businessId)

  return (
    <section className={styles.stack}>
      <h1 className={styles.pageTitleSr}>Ödeme geçmişi</h1>
      <h2 className={styles.heading}>Ödeme geçmişi</h2>
      <p className={styles.intro}>
        Masada <strong>Ödeme Alındı</strong> ile kapattığınız hesaplar burada listelenir. Açık siparişler
        masalar ekranında kalır.
      </p>

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
        <ul className={styles.list} aria-label="Ödemeler">
          {rows.map((r) => {
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
