import { cn } from '@/utils/cn'
import styles from './TableMasaIcon.module.css'

export type TableMasaIconProps = {
  label: string
  highlight?: boolean
  className?: string
}

/** Üstten bakış masa görseli — panel mock ile uyumlu ince çizim */
export function TableMasaIcon({ label, highlight = false, className }: TableMasaIconProps) {
  return (
    <div className={cn(styles.root, highlight && styles.highlight, className)}>
      <div className={styles.figure}>
        <svg
          className={styles.svg}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect className={styles.surface} x="7" y="7" width="10" height="10" rx="1.5" />
          <rect className={styles.arm} x="9" y="3" width="6" height="2" rx="0.5" />
          <rect className={styles.arm} x="9" y="19" width="6" height="2" rx="0.5" />
          <rect className={styles.arm} x="3" y="9" width="2" height="6" rx="0.5" />
          <rect className={styles.arm} x="19" y="9" width="2" height="6" rx="0.5" />
        </svg>
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  )
}
