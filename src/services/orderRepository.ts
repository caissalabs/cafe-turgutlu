import { supabase } from '@/lib/supabaseClient'
import type { CafeOrder, CafeOrderRow, OrderLine } from '@/types/order'

function mapRow(row: CafeOrderRow): CafeOrder {
  return {
    id: row.id,
    tableNumber: row.table_number,
    lines: Array.isArray(row.lines) ? row.lines : [],
    totalTry: Number(row.total_try),
    createdAt: row.created_at,
  }
}

export async function fetchAllOrders(businessId: string): Promise<CafeOrder[]> {
  const { data, error } = await supabase
    .from('cafe_orders')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as CafeOrderRow[]).map(mapRow)
}

export async function fetchOrdersByTable(
  businessId: string,
  tableNumber: number,
): Promise<CafeOrder[]> {
  const { data, error } = await supabase
    .from('cafe_orders')
    .select('*')
    .eq('business_id', businessId)
    .eq('table_number', tableNumber)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as CafeOrderRow[]).map(mapRow)
}

export async function transferOrdersBetweenTables(
  businessId: string,
  fromTableNumber: number,
  toTableNumber: number,
): Promise<void> {
  if (fromTableNumber === toTableNumber) return
  const { error } = await supabase
    .from('cafe_orders')
    .update({ table_number: toTableNumber })
    .eq('business_id', businessId)
    .eq('table_number', fromTableNumber)
  if (error) throw error
}

export async function deleteOrdersForTable(
  businessId: string,
  tableNumber: number,
): Promise<void> {
  const { error } = await supabase
    .from('cafe_orders')
    .delete()
    .eq('business_id', businessId)
    .eq('table_number', tableNumber)
  if (error) throw error
}

export async function submitOrder(
  businessId: string,
  input: {
    tableNumber: number
    lines: OrderLine[]
    totalTry: number
  },
): Promise<string> {
  const { data, error } = await supabase
    .from('cafe_orders')
    .insert({
      business_id: businessId,
      table_number: input.tableNumber,
      lines: input.lines,
      total_try: input.totalTry,
    })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

export async function updateOrder(
  businessId: string,
  orderId: string,
  patch: { lines: OrderLine[]; totalTry: number },
): Promise<void> {
  const { error } = await supabase
    .from('cafe_orders')
    .update({ lines: patch.lines, total_try: patch.totalTry })
    .eq('id', orderId)
    .eq('business_id', businessId)
  if (error) throw error
}

export async function deleteOrderById(businessId: string, orderId: string): Promise<void> {
  const { error } = await supabase
    .from('cafe_orders')
    .delete()
    .eq('id', orderId)
    .eq('business_id', businessId)
  if (error) throw error
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

  const channel = supabase
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
    void supabase.removeChannel(channel)
  }
}
