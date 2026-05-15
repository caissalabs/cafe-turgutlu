import { supabase } from '@/lib/supabaseClient'
import type { CafeOrder, CafeOrderRow, OrderLine } from '@/types/order'

function orderStorageKey(businessId: string): string {
  return `cafe-turgutlu-orders::${businessId}`
}

function mapRow(row: CafeOrderRow): CafeOrder {
  return {
    id: row.id,
    tableNumber: row.table_number,
    lines: Array.isArray(row.lines) ? row.lines : [],
    totalTry: Number(row.total_try),
    createdAt: row.created_at,
  }
}

function readLocalOrders(businessId: string): CafeOrder[] {
  try {
    const raw = localStorage.getItem(orderStorageKey(businessId))
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

function writeLocalOrders(businessId: string, orders: CafeOrder[]) {
  localStorage.setItem(orderStorageKey(businessId), JSON.stringify(orders))
}

export async function fetchAllOrders(businessId: string): Promise<CafeOrder[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('cafe_orders')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return ((data ?? []) as CafeOrderRow[]).map(mapRow)
  }
  return readLocalOrders(businessId)
}

export async function fetchOrdersByTable(
  businessId: string,
  tableNumber: number,
): Promise<CafeOrder[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('cafe_orders')
      .select('*')
      .eq('business_id', businessId)
      .eq('table_number', tableNumber)
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as CafeOrderRow[]).map(mapRow)
  }
  return readLocalOrders(businessId).filter((o) => o.tableNumber === tableNumber)
}

export async function transferOrdersBetweenTables(
  businessId: string,
  fromTableNumber: number,
  toTableNumber: number,
): Promise<void> {
  if (fromTableNumber === toTableNumber) return
  if (supabase) {
    const { error } = await supabase
      .from('cafe_orders')
      .update({ table_number: toTableNumber })
      .eq('business_id', businessId)
      .eq('table_number', fromTableNumber)
    if (error) throw error
    return
  }
  const orders = readLocalOrders(businessId).map((o) =>
    o.tableNumber === fromTableNumber ? { ...o, tableNumber: toTableNumber } : o,
  )
  writeLocalOrders(businessId, orders)
}

export async function deleteOrdersForTable(
  businessId: string,
  tableNumber: number,
): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('cafe_orders')
      .delete()
      .eq('business_id', businessId)
      .eq('table_number', tableNumber)
    if (error) throw error
    return
  }
  const next = readLocalOrders(businessId).filter((o) => o.tableNumber !== tableNumber)
  writeLocalOrders(businessId, next)
}

export async function submitOrder(
  businessId: string,
  input: {
    tableNumber: number
    lines: OrderLine[]
    totalTry: number
  },
): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('cafe_orders').insert({
      business_id: businessId,
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
  writeLocalOrders(businessId, [order, ...readLocalOrders(businessId)])
}

export function subscribeOrders(
  businessId: string,
  onOrders: (orders: CafeOrder[]) => void ,
): () => void {
  let cancelled = false

  const refresh = () => {
    void fetchAllOrders(businessId).then((list) => {
      if (!cancelled) onOrders(list)
    })
  }

  refresh()

  if (supabase) {
    const client = supabase
    const channel = client
      .channel(`cafe_orders_${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cafe_orders',
          filter: `business_id=eq.${businessId}`,
        },
        () => refresh(),
      )
      .subscribe()

    return () => {
      cancelled = true
      void client.removeChannel(channel)
    }
  }

  const key = orderStorageKey(businessId)
  const onStorage = (ev: StorageEvent) => {
    if (ev.key === key) refresh()
  }
  window.addEventListener('storage', onStorage)
  const interval = window.setInterval(refresh, 2500)

  return () => {
    cancelled = true
    window.removeEventListener('storage', onStorage)
    window.clearInterval(interval)
  }
}
