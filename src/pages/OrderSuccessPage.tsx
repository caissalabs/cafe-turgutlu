import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import styles from './OrderSuccessPage.module.css'

export function OrderSuccessPage() {
  useDocumentTitle('CafeNET — Sipariş alındı')

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>CafeNET</span>
      </header>
      <main className={styles.main}>
        <div className={styles.card}>
          <p className={styles.lead}>Siparişiniz alındı</p>
          <h1 className={styles.title}>Siparişinizi hemen hazırlıyoruz.</h1>
          <p className={styles.note}>Teşekkür ederiz.</p>
        </div>
      </main>
      <footer className={styles.footer}>CafeNET</footer>
    </div>
  )
}
