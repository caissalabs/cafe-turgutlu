export type MenuItem = {
  name: string
  /** Türk lirası (gösterimde ₺ ile) */
  price: number
}

export type MenuCategory = {
  id: string
  title: string
  items: MenuItem[]
}

/** Basit menü listesi — ileride veritabanı veya admin panelinden yönetilebilir. */
export const MENU_CATEGORIES: MenuCategory[] = [
  {
    id: 'food',
    title: 'Yiyecekler',
    items: [
      { name: 'Karışık tost', price: 185 },
      { name: 'Peynirli börek', price: 165 },
      { name: 'Sandviç', price: 225 },
      { name: 'Patates kızartması', price: 145 },
      { name: 'Menemen', price: 210 },
    ],
  },
  {
    id: 'drink',
    title: 'İçecekler',
    items: [
      { name: 'Türk kahvesi', price: 95 },
      { name: 'Filtre kahve', price: 125 },
      { name: 'Çay', price: 35 },
      { name: 'Soğuk çay', price: 75 },
      { name: 'Kola', price: 85 },
      { name: 'Ayran', price: 70 },
      { name: 'Su', price: 30 },
    ],
  },
]

export function formatPriceTry(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount)
}
