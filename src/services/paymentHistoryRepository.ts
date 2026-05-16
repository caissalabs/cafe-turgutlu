import { supabase } from '@/lib/supabaseClient'
import type { CafePaymentHistoryRecord, CafePaymentHistoryRow } from '@/types/paymentHistory'
import type { CafeOrder, OrderLine } from '@/types/order'
import { deleteOrdersForTable, fetchOrdersByTable } from '@/services/orderRepository'

export function mergeOrderLinesForSnapshot(orders: CafeOrder[]): OrderLine[] {
  const map = new Map<string, OrderLine>()
  for (const o of orders) {
    for (const line of o.lines) {
      const prev = map.get(line.key)
      if (prev) {
        map.set(line.key, { ...prev, qty: prev.qty + line.qty })
      } else {
        map.set(line.key, { ...line })
      }
    }
  }
  return [...map.values()]
}

function mapPaymentRow(row: CafePaymentHistoryRow): CafePaymentHistoryRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    tableNumber: row.table_number,
    tableDisplayName: row.table_display_name,
    totalTry: Number(row.total_try),
    orderCount: row.order_count,
    lines: Array.isArray(row.lines) ? row.lines : [],
    paidAt: row.paid_at,
  }
}

export async function fetchPaymentHistory(businessId: string): Promise<CafePaymentHistoryRecord[]> {
  const { data, error } = await supabase
    .from('cafe_payment_history')
    .select('*')
    .eq('business_id', businessId)
    .order('paid_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as CafePaymentHistoryRow[]).map(mapPaymentRow)
}

/**
 * Masadaki tüm siparişleri özetleyip ödeme geçmişine yazar ve siparişleri siler.
 */
export async function settleTablePayment(
  businessId: string,
  tableNumber: number,
  options?: { tableDisplayName?: string | null },
): Promise<void> {
  const orders = await fetchOrdersByTable(businessId, tableNumber)
  if (orders.length === 0) {
    throw new Error('Bu masada kayıtlı sipariş yok.')
  }

  const lines = mergeOrderLinesForSnapshot(orders)
  const totalTry = orders.reduce((acc, o) => acc + o.totalTry, 0)
  const orderCount = orders.length
  const tableDisplayName =
    options?.tableDisplayName !== undefined ? options.tableDisplayName?.trim() || null : null

  const { error: insertError } = await supabase.from('cafe_payment_history').insert({
    business_id: businessId,
    table_number: tableNumber,
    table_display_name: tableDisplayName,
    total_try: totalTry,
    order_count: orderCount,
    lines,
  })
  if (insertError) throw insertError
  await deleteOrdersForTable(businessId, tableNumber)
}

export function subscribePaymentHistory(
  businessId: string,
  onRows: (rows: CafePaymentHistoryRecord[]) => void,
): () => void {
  let cancelled = false

  const refresh = () => {
    void fetchPaymentHistory(businessId).then((list) => {
      if (!cancelled) onRows(list)
    })
  }

  refresh()

  const channel = supabase
    .channel(`cafe_payment_history_${businessId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'cafe_payment_history',
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
