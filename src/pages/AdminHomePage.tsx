import { NewOrderAlertModal } from '@/components/NewOrderAlertModal'
import { TablesPanel } from '@/components/TablesPanel'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useNewOrderAttention } from '@/hooks/useNewOrderAttention'
import { useOrders } from '@/hooks/useOrders'
import styles from './AdminHomePage.module.css'

export function AdminHomePage() {
  useDocumentTitle('Cafe Turgutlu — Yönetim paneli')
  const { orders, loading, error, refreshOrders } = useOrders()
  const attention = useNewOrderAttention(orders)

  return (
    <section className={styles.stack}>
      <NewOrderAlertModal
        open={attention.incomingOpen}
        tableNumbers={attention.alertTables}
        onDismiss={attention.dismissIncoming}
      />
      <h1>Yönetim paneli</h1>
      {error ? (
        <p className={styles.err} role="alert">
          {error}
        </p>
      ) : null}
      <TablesPanel
        orders={orders}
        loading={loading}
        onOrdersRefresh={refreshOrders}
        attentionTableIds={attention.attentionTables}
        onClearTableAttention={attention.clearAttention}
      />
    </section>
  )
}
