export type OrderLine = {
  /** Sepette bir satırı tanımlamak için */
  key: string
  name: string
  price: number
  qty: number
}

export type CafeOrder = {
  id: string
  tableNumber: number
  lines: OrderLine[]
  totalTry: number
  createdAt: string
}
