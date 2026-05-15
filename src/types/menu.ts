export type CafeMenuItem = {
  id: string
  categoryId: string
  name: string
  description: string
  price: number
  allergens: string[]
  imageUrl: string | null
  sortOrder: number
}

export type CafeMenuCategory = {
  id: string
  title: string
  sortOrder: number
  items: CafeMenuItem[]
}

export type CafeMenuCategoryRow = {
  id: string
  business_id: string
  title: string
  sort_order: number
}

export type CafeMenuItemRow = {
  id: string
  business_id: string
  category_id: string
  name: string
  description: string
  price: number
  allergens: string[] | null
  image_url: string | null
  sort_order: number
}
