import type { CafeOrder, OrderLine } from '@/types/order'

const LOCAL_KEY = 'cafe-turgutlu-orders-v1'

function readLocalOrders(): CafeOrder[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (o): o is CafeOrder =>
          typeof o === 'object' &&
          o !== null &&
          'id' in o &&
          'tableNumber' in o &&
          'lines' in o &&
          'totalTry' in o &&
          'createdAt' in o,
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch {
    return []
  }
}

function writeLocalOrders(orders: CafeOrder[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(orders))
}

export function fetchAllOrders(): CafeOrder[] {
  return readLocalOrders()
}

export async function submitOrder(input: {
  tableNumber: number
  lines: OrderLine[]
  totalTry: number
}): Promise<void> {
  const order: CafeOrder = {
    id: crypto.randomUUID(),
    tableNumber: input.tableNumber,
    lines: input.lines,
    totalTry: input.totalTry,
    createdAt: new Date().toISOString(),
  }
  writeLocalOrders([order, ...readLocalOrders()])
}

/**
 * Sipariş listesini dinler: başka sekmede yapılan güncellemeler storage olayıyla,
 * aynı sekmede küçük bir aralıkla yenilenir.
 */
export function subscribeOrders(onOrders: (orders: CafeOrder[]) => void): () => void {
  let cancelled = false

  const refresh = () => {
    if (!cancelled) onOrders(fetchAllOrders())
  }

  refresh()

  const onStorage = (ev: StorageEvent) => {
    if (ev.key === LOCAL_KEY) refresh()
  }
  window.addEventListener('storage', onStorage)
  const interval = window.setInterval(refresh, 2500)

  return () => {
    cancelled = true
    window.removeEventListener('storage', onStorage)
    window.clearInterval(interval)
  }
}
