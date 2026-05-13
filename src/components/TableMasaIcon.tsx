import { cn } from '@/utils/cn'
import styles from './TableMasaIcon.module.css'

export type TableMasaIconProps = {
  label: string
  highlight?: boolean
  className?: string
}

export function TableMasaIcon({ label, highlight = false, className }: TableMasaIconProps) {
  return (
    <div className={cn(styles.root, highlight && styles.highlight, className)}>
      <svg
        className={styles.svg}
        viewBox="0 0 90 100"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Sandalyeler — sol üst, sağ üst */}
        <rect className={styles.chair} x="2"  y="10" width="26" height="14" rx="5" />
        <rect className={styles.chair} x="62" y="10" width="26" height="14" rx="5" />
        {/* Sandalyeler — sol alt, sağ alt */}
        <rect className={styles.chair} x="2"  y="76" width="26" height="14" rx="5" />
        <rect className={styles.chair} x="62" y="76" width="26" height="14" rx="5" />
        {/* Masa */}
        <rect className={styles.table} x="33" y="6" width="24" height="88" rx="8" />
      </svg>
      <span className={styles.label}>{label}</span>
    </div>
  )
}
