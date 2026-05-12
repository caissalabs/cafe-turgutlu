import { TablesPanel } from '@/components/TablesPanel'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useOrders } from '@/hooks/useOrders'
import styles from './AdminHomePage.module.css'

export function AdminHomePage() {
  useDocumentTitle('Cafe Turgutlu — Yönetim paneli')
  const { orders, loading } = useOrders()

  return (
    <section className={styles.stack}>
      <h1>Yönetim paneli</h1>
      <div className={styles.info} role="status">
        Siparişler bu tarayıcıda saklanır; müşteri ile yönetim panelini{' '}
        <strong>aynı cihaz ve tarayıcıda</strong> (ör. tablet kiosk) kullanırsanız masalar burada güncellenir. Telefon +
        kasa bilgisayarı gibi farklı cihazlarda siparişler birbirini görmez.
      </div>
      <TablesPanel orders={orders} loading={loading} />
    </section>
  )
}
