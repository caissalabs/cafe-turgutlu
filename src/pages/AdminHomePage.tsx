import { TablesPanel } from '@/components/TablesPanel'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import styles from './AdminHomePage.module.css'

export function AdminHomePage() {
  useDocumentTitle('Cafe Turgutlu — Yönetim paneli')

  return (
    <section className={styles.stack}>
      <h1>Yönetim paneli</h1>
      <TablesPanel />
    </section>
  )
}
