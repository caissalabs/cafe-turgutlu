import { TablesPanel } from '@/components/TablesPanel'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useOrders } from '@/hooks/useOrders'
import styles from './AdminHomePage.module.css'

export function AdminHomePage() {
  useDocumentTitle('Cafe Turgutlu — Yönetim paneli')
  const { orders, loading, error, storageKind, refreshOrders } = useOrders()

  return (
    <section className={styles.stack}>
      <h1>Yönetim paneli</h1>
      {storageKind === 'supabase' ? (
        <div className={styles.info} role="status">
          Siparişler <strong>Supabase</strong> üzerinde tutulur; müşteri telefonu ile bu panel farklı cihazlarda olsa da
          siparişler senkron görünür (Realtime ile güncellenir).
        </div>
      ) : (
        <div className={styles.warn} role="status">
          <strong>Supabase yapılandırılmadı:</strong> Siparişler yalnızca bu tarayıcıda saklanıyor. Production için{' '}
          <code className={styles.code}>VITE_SUPABASE_URL</code> ve{' '}
          <code className={styles.code}>VITE_SUPABASE_ANON_KEY</code> ekleyip yeniden build edin; projedeki{' '}
          <code className={styles.code}>supabase-schema.sql</code> dosyasını Supabase SQL Editor&apos;de çalıştırın.
        </div>
      )}
      {error ? (
        <p className={styles.err} role="alert">
          {error}
        </p>
      ) : null}
      <TablesPanel orders={orders} loading={loading} onOrdersRefresh={refreshOrders} />
    </section>
  )
}
