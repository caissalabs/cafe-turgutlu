import { supabase } from '@/lib/supabaseClient'
import type { CafeOrder, CafeOrderRow, OrderLine } from '@/types/order'

const LOCAL_KEY = 'cafe-turgutlu-orders-v1'

function mapRow(row: CafeOrderRow): CafeOrder {
  return {
    id: row.id,
    tableNumber: row.table_number,
    lines: Array.isArray(row.lines) ? row.lines : [],
    totalTry: Number(row.total_try),
    createdAt: row.created_at,
  }
}

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

export async function fetchAllOrders(): Promise<CafeOrder[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('cafe_orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return ((data ?? []) as CafeOrderRow[]).map(mapRow)
  }
  return readLocalOrders()
}

/** Tüm siparişleri bir masadan diğerine taşır (aynı kayıtlar, yalnızca masa numarası değişir). */
export async function transferOrdersBetweenTables(
  fromTableNumber: number,
  toTableNumber: number,
): Promise<void> {
  if (fromTableNumber === toTableNumber) return
  if (supabase) {
    const { error } = await supabase
      .from('cafe_orders')
      .update({ table_number: toTableNumber })
      .eq('table_number', fromTableNumber)
    if (error) throw error
    return
  }
  const orders = readLocalOrders().map((o) =>
    o.tableNumber === fromTableNumber ? { ...o, tableNumber: toTableNumber } : o,
  )
  writeLocalOrders(orders)
}

/** Masanın tüm sipariş kayıtlarını siler (Supabase veya yerel depo). */
export async function deleteOrdersForTable(tableNumber: number): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('cafe_orders')
      .delete()
      .eq('table_number', tableNumber)
    if (error) throw error
    return
  }
  const next = readLocalOrders().filter((o) => o.tableNumber !== tableNumber)
  writeLocalOrders(next)
}

export async function submitOrder(input: {
  tableNumber: number
  lines: OrderLine[]
  totalTry: number
}): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('cafe_orders').insert({
      table_number: input.tableNumber,
      lines: input.lines,
      total_try: input.totalTry,
    })
    if (error) throw error
    return
  }

  const order: CafeOrder = {
    id: crypto.randomUUID(),
    tableNumber: input.tableNumber,
    lines: input.lines,
    totalTry: input.totalTry,
    createdAt: new Date().toISOString(),
  }
  writeLocalOrders([order, ...readLocalOrders()])
}

export function subscribeOrders(onOrders: (orders: CafeOrder[]) => void): () => void {
  let cancelled = false

  const refresh = () => {
    void fetchAllOrders().then((list) => {
      if (!cancelled) onOrders(list)
    })
  }

  refresh()

  if (supabase) {
    const client = supabase
    const channel = client
      .channel('cafe_orders_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cafe_orders' },
        () => refresh(),
      )
      .subscribe()

    return () => {
      cancelled = true
      void client.removeChannel(channel)
    }
  }

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
