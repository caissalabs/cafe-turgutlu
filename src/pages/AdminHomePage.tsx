import { TablesPanel } from '@/components/TablesPanel'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useOrders } from '@/hooks/useOrders'
import styles from './AdminHomePage.module.css'

export function AdminHomePage() {
  useDocumentTitle('Cafe Turgutlu — Yönetim paneli')
  const { orders, loading, error, refreshOrders } = useOrders()

  return (
    <section className={styles.stack}>
      <h1>Yönetim paneli</h1>
      {error ? (
        <p className={styles.err} role="alert">
          {error}
        </p>
      ) : null}
      <TablesPanel orders={orders} loading={loading} onOrdersRefresh={refreshOrders} />
    </section>
  )
}
