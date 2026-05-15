import { supabase } from '@/lib/supabaseClient'
import type { CafePaymentHistoryRecord, CafePaymentHistoryRow } from '@/types/paymentHistory'
import type { CafeOrder, OrderLine } from '@/types/order'
import { deleteOrdersForTable, fetchOrdersByTable } from '@/services/orderRepository'

function paymentHistoryStorageKey(businessId: string): string {
  return `cafe-turgutlu-payment-history::${businessId}`
}

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

function readLocalPaymentHistory(businessId: string): CafePaymentHistoryRecord[] {
  try {
    const raw = localStorage.getItem(paymentHistoryStorageKey(businessId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (r): r is CafePaymentHistoryRecord =>
          typeof r === 'object' &&
          r !== null &&
          'id' in r &&
          'tableNumber' in r &&
          'totalTry' in r &&
          'paidAt' in r,
      )
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
  } catch {
    return []
  }
}

function writeLocalPaymentHistory(businessId: string, rows: CafePaymentHistoryRecord[]) {
  localStorage.setItem(paymentHistoryStorageKey(businessId), JSON.stringify(rows))
}

export async function fetchPaymentHistory(businessId: string): Promise<CafePaymentHistoryRecord[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('cafe_payment_history')
      .select('*')
      .eq('business_id', businessId)
      .order('paid_at', { ascending: false })

    if (error) throw error
    return ((data ?? []) as CafePaymentHistoryRow[]).map(mapPaymentRow)
  }
  return readLocalPaymentHistory(businessId)
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

  if (supabase) {
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
    return
  }

  const id = crypto.randomUUID()
  const paidAt = new Date().toISOString()
  const row: CafePaymentHistoryRecord = {
    id,
    businessId,
    tableNumber,
    tableDisplayName,
    totalTry,
    orderCount,
    lines,
    paidAt,
  }
  writeLocalPaymentHistory(businessId, [row, ...readLocalPaymentHistory(businessId)])
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

  if (supabase) {
    const client = supabase
    const channel = client
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
      void client.removeChannel(channel)
    }
  }

  const key = paymentHistoryStorageKey(businessId)
  const onStorage = (ev: StorageEvent) => {
    if (ev.key === key) refresh()
  }
  window.addEventListener('storage', onStorage)
  const interval = window.setInterval(refresh, 3500)

  return () => {
    cancelled = true
    window.removeEventListener('storage', onStorage)
    window.clearInterval(interval)
  }
}
