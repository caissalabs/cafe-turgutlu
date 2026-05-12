import { CAFE_TABLES } from '@/constants/tables'
import styles from './TablesPanel.module.css'

export function TablesPanel() {
  return (
    <div className={styles.wrap}>
      <h2 className={styles.heading}>Masalar</h2>
      <p className={styles.hint}>Toplam {CAFE_TABLES.length} masa</p>
      <ul className={styles.grid} aria-label="Cafe masaları">
        {CAFE_TABLES.map((table) => (
          <li key={table.id} className={styles.card}>
            <span className={styles.cardTitle}>{table.name}</span>
            <span className={styles.cardMeta}>Masa {table.id}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
