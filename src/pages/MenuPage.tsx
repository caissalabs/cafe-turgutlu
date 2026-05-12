import { MENU_CATEGORIES, formatPriceTry } from '@/constants/menu'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import styles from './MenuPage.module.css'

export function MenuPage() {
  useDocumentTitle('Cafe Turgutlu — Menü')

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.brand}>Cafe Turgutlu</span>
        </div>
      </header>

      <main className={styles.main}>
        <h1 className={styles.title}>Menü</h1>
        <p className={styles.subtitle}>Yiyecek ve içeceklerimiz</p>

        <div className={styles.categories}>
          {MENU_CATEGORIES.map((category) => (
            <section key={category.id} aria-labelledby={`menu-${category.id}`}>
              <h2 className={styles.categoryTitle} id={`menu-${category.id}`}>
                {category.title}
              </h2>
              <ul className={styles.list}>
                {category.items.map((item) => (
                  <li
                    key={`${category.id}-${item.name}`}
                    className={styles.item}
                  >
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={styles.itemPrice} aria-label="Fiyat">
                      {formatPriceTry(item.price)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>

      <footer className={styles.footer}>Cafe Turgutlu — Turgutlu</footer>
    </div>
  )
}
