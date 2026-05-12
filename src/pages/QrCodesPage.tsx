import { CAFE_TABLES } from '@/constants/tables'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import styles from './QrCodesPage.module.css'

function siteBase(): string {
  const fromEnv = import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (fromEnv) return fromEnv
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

function qrImgSrc(data: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent(data)}`
}

export function QrCodesPage() {
  useDocumentTitle('Cafe Turgutlu — QR kodlar')
  const base = siteBase()

  return (
    <section className={styles.stack}>
      <h1>Masa QR kodları</h1>
      <p className={styles.lead}>
        Her kod ilgili masayı URL ile taşır (ör. <code className={styles.code}>…/menu?masa=3</code>). Üretimde doğru
        alan adı için Railway&apos;de <code className={styles.code}>VITE_PUBLIC_SITE_URL</code> tanımlayın; boşsa
        şu anki site adresi kullanılır.
      </p>

      <ul className={styles.grid}>
        {CAFE_TABLES.map((t) => {
          const url = `${base}/menu?masa=${t.id}`
          return (
            <li key={t.id} className={styles.card}>
              <span className={styles.tableLabel}>Masa {t.id}</span>
              <img
                src={qrImgSrc(url)}
                alt={`Masa ${t.id} menü QR`}
                className={styles.qr}
                width={192}
                height={192}
                loading="lazy"
                decoding="async"
              />
              <code className={styles.url}>{url}</code>
              <a href={url} className={styles.link} target="_blank" rel="noreferrer">
                Menüyü aç
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
