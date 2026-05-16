import type { CafePaymentHistoryRecord } from '@/types/paymentHistory'

export type PeriodPreset = 'all' | 'day' | 'week' | 'month' | 'year'

export function parsePaidAt(iso: string): Date {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? new Date(0) : d
}

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

/** Pazartesi başlangıçlı hafta */
export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}

export function startOfMonth(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1)
  x.setHours(0, 0, 0, 0)
  return x
}

export function startOfYear(d: Date): Date {
  const x = new Date(d.getFullYear(), 0, 1)
  x.setHours(0, 0, 0, 0)
  return x
}

function periodStart(preset: Exclude<PeriodPreset, 'all'>, now: Date): Date {
  switch (preset) {
    case 'day':
      return startOfLocalDay(now)
    case 'week':
      return startOfWeekMonday(now)
    case 'month':
      return startOfMonth(now)
    case 'year':
      return startOfYear(now)
    default:
      return new Date(0)
  }
}

/** Ön ayarlı dönem: başlangıç (dahil) — şu ana kadar */
export function filterByPeriodPreset(
  rows: CafePaymentHistoryRecord[],
  preset: PeriodPreset,
  now = new Date(),
): CafePaymentHistoryRecord[] {
  if (preset === 'all') return rows
  const start = periodStart(preset, now)
  return rows.filter((r) => {
    const t = parsePaidAt(r.paidAt).getTime()
    return t >= start.getTime() && t <= now.getTime()
  })
}

export function filterByProductKeys(
  rows: CafePaymentHistoryRecord[],
  keys: ReadonlySet<string>,
): CafePaymentHistoryRecord[] {
  if (keys.size === 0) return rows
  return rows.filter((r) => r.lines.some((l) => keys.has(l.key)))
}

export function sortByPaidAt(
  rows: CafePaymentHistoryRecord[],
  ascending: boolean,
): CafePaymentHistoryRecord[] {
  return [...rows].sort((a, b) => {
    const ta = parsePaidAt(a.paidAt).getTime()
    const tb = parsePaidAt(b.paidAt).getTime()
    return ascending ? ta - tb : tb - ta
  })
}

export function sumTotalTry(rows: CafePaymentHistoryRecord[]): number {
  return rows.reduce((acc, r) => acc + r.totalTry, 0)
}

/** Bugün / bu hafta / bu ay / bu yıl kazanç (tam gün sınırları, yerel saat) */
export function periodEarnings(
  rows: CafePaymentHistoryRecord[],
  now = new Date(),
): { day: number; week: number; month: number; year: number } {
  const dayStart = startOfLocalDay(now)
  const dayEnd = endOfLocalDay(now)
  const weekStart = startOfWeekMonday(now)
  const monthStart = startOfMonth(now)
  const yearStart = startOfYear(now)

  let day = 0
  let week = 0
  let month = 0
  let year = 0

  for (const r of rows) {
    const t = parsePaidAt(r.paidAt).getTime()
    const v = r.totalTry
    if (t >= dayStart.getTime() && t <= dayEnd.getTime()) day += v
    if (t >= weekStart.getTime() && t <= now.getTime()) week += v
    if (t >= monthStart.getTime() && t <= now.getTime()) month += v
    if (t >= yearStart.getTime() && t <= now.getTime()) year += v
  }

  return { day, week, month, year }
}

export type HourBucket = { hour: number; orderUnits: number; payments: number }

/** Saat 0–23: sipariş birimi = özet kayıttaki orderCount toplamı */
export function aggregateHourDensity(rows: CafePaymentHistoryRecord[]): HourBucket[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    orderUnits: 0,
    payments: 0,
  }))
  for (const r of rows) {
    const h = parsePaidAt(r.paidAt).getHours()
    buckets[h]!.orderUnits += r.orderCount
    buckets[h]!.payments += 1
  }
  return buckets
}

export type WeekdayBucket = { weekdayIndex: number; label: string; orderUnits: number; payments: number }

const WEEKDAY_LABELS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const

/** Pazartesi = 0 … Pazar = 6 */
export function toMondayFirstWeekday(d: Date): number {
  const day = d.getDay()
  return day === 0 ? 6 : day - 1
}

export function aggregateWeekdayDensity(rows: CafePaymentHistoryRecord[]): WeekdayBucket[] {
  const buckets: WeekdayBucket[] = WEEKDAY_LABELS_TR.map((label, weekdayIndex) => ({
    weekdayIndex,
    label,
    orderUnits: 0,
    payments: 0,
  }))
  for (const r of rows) {
    const w = toMondayFirstWeekday(parsePaidAt(r.paidAt))
    buckets[w]!.orderUnits += r.orderCount
    buckets[w]!.payments += 1
  }
  return buckets
}

export type ProductAgg = {
  key: string
  name: string
  qty: number
  revenue: number
}

export function aggregateProducts(rows: CafePaymentHistoryRecord[]): ProductAgg[] {
  const map = new Map<string, ProductAgg>()
  for (const r of rows) {
    for (const line of r.lines) {
      const prev = map.get(line.key)
      const addQty = line.qty
      const addRev = line.price * line.qty
      if (prev) {
        prev.qty += addQty
        prev.revenue += addRev
      } else {
        map.set(line.key, { key: line.key, name: line.name, qty: addQty, revenue: addRev })
      }
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty)
}

export type ProductOption = { key: string; name: string }

export function collectProductOptions(rows: CafePaymentHistoryRecord[]): ProductOption[] {
  const map = new Map<string, string>()
  for (const r of rows) {
    for (const line of r.lines) {
      if (!map.has(line.key)) map.set(line.key, line.name)
    }
  }
  return [...map.entries()]
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
}

function csvEscape(cell: string): string {
  if (/[;\r\n"]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`
  return cell
}

/** Excel TR: UTF-8 BOM + noktalı virgül ayırıcı */
export function paymentHistoryToCsv(rows: CafePaymentHistoryRecord[]): string {
  const sep = ';'
  const headers = ['Ödeme tarihi (ISO)', 'Masa no', 'Masa adı', 'Sipariş adedi', 'Tutar', 'Ürün özeti']
  const lines = rows.map((r) => {
    const summary = r.lines.map((l) => `${l.name} ×${l.qty}`).join(' | ')
    const name = r.tableDisplayName?.trim() || ''
    return [
      csvEscape(r.paidAt),
      csvEscape(String(r.tableNumber)),
      csvEscape(name),
      csvEscape(String(r.orderCount)),
      csvEscape(String(r.totalTry)),
      csvEscape(summary),
    ].join(sep)
  })
  const body = [headers.join(sep), ...lines].join('\r\n')
  return `\uFEFF${body}`
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
