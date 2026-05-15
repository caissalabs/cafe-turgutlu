import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { NewOrderAlertModal } from '@/components/NewOrderAlertModal'
import { TablesPanel } from '@/components/TablesPanel'
import { useAuth } from '@/hooks/useAuth'
import { useCafeMenu } from '@/hooks/useCafeMenu'
import { useCafeTables } from '@/hooks/useCafeTables'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useNewOrderAttention } from '@/hooks/useNewOrderAttention'
import { useOrders } from '@/hooks/useOrders'
import styles from './AdminHomePage.module.css'

const SAMPLE_TABLE_NUMBERS = [1, 2, 3] as const

function menuUrlsForTables(origin: string, businessId: string) {
  return SAMPLE_TABLE_NUMBERS.map((n) => {
    const u = new URL('/menu', origin)
    u.searchParams.set('business', businessId)
    u.searchParams.set('masa', String(n))
    return { table: n, href: u.toString() }
  })
}

export function AdminHomePage() {
  useDocumentTitle('Cafe Turgutlu — Yönetim paneli')
  const { businessId } = useAuth()
  const { orders, loading, error, refreshOrders } = useOrders(businessId)
  const cafe = useCafeTables(businessId)
  const menu = useCafeMenu(businessId)
  const attention = useNewOrderAttention({
    businessId,
    orders,
    ordersLoading: loading,
    tables: cafe.tables,
    tablesLoading: cafe.tablesLoading,
    refreshTables: cafe.refreshTables,
  })

  const qrLinks = useMemo(() => {
    if (!businessId || typeof window === 'undefined') return []
    return menuUrlsForTables(window.location.origin, businessId)
  }, [businessId])

  return (
    <section className={styles.stack}>
      <NewOrderAlertModal
        open={attention.incomingOpen}
        tableNumbers={attention.alertTables}
        onDismiss={attention.dismissIncoming}
      />
      {!menu.loading && !menu.isConfigured ? (
        <div className={styles.menuBanner} role="status">
          <strong>Menünüzü ayarlayın.</strong> Müşteriler menüyü görebilmek için en az bir kategori ve ürün
          eklemeniz gerekir (görsel, açıklama ve alerjenler isteğe bağlı).
          <Link to="/home/menu">Menüyü düzenle →</Link>
        </div>
      ) : null}
      <h1>Yönetim paneli</h1>
      {qrLinks.length > 0 ? (
        <div className={styles.qrBlock}>
          <p className={styles.qrBlockTitle}>Menü bağlantıları (QR için)</p>
          <ul className={styles.qrList}>
            {qrLinks.map(({ table, href }) => (
              <li key={table} className={styles.qrRow}>
                <span className={styles.qrLabel}>Masa {table}</span>
                <a className={styles.qrLink} href={href} target="_blank" rel="noopener noreferrer">
                  {href}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? (
        <p className={styles.err} role="alert">
          {error}
        </p>
      ) : null}
      <TablesPanel
        businessId={businessId}
        orders={orders}
        loading={loading}
        onOrdersRefresh={refreshOrders}
        attentionTableIds={attention.attentionTables}
        onClearTableAttention={attention.clearAttention}
        tables={cafe.tables}
        names={cafe.names}
        setNickname={cafe.setNickname}
        addTable={cafe.addTable}
        removeTable={cafe.removeTable}
      />
    </section>
  )
}
