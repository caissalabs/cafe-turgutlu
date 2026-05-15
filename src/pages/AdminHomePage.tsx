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
