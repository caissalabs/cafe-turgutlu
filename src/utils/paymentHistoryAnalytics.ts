import type { CafePaymentHistoryRecord } from '@/types/paymentHistory'
import type { CafeMenuCategory } from '@/types/menu'

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

/** Ödemenin yerel saatinde [fromHour, toHour] dahil (0–23). from > to ise değerler otomatik yer değiştirir. */
export function filterByLocalHourRange(
  rows: CafePaymentHistoryRecord[],
  fromHour: number,
  toHour: number,
): CafePaymentHistoryRecord[] {
  let from = Math.min(23, Math.max(0, Math.floor(fromHour)))
  let to = Math.min(23, Math.max(0, Math.floor(toHour)))
  if (from > to) {
    const t = from
    from = to
    to = t
  }
  if (from === 0 && to === 23) return rows
  return rows.filter((r) => {
    const h = parsePaidAt(r.paidAt).getHours()
    return h >= from && h <= to
  })
}

/** Yerel saat diliminde 3 saatlik dilim (0–7). null = filtre yok. Dilim i: saat i*3 .. i*3+2 */
export function filterByThreeHourSlot(
  rows: CafePaymentHistoryRecord[],
  slotIndex: number | null,
): CafePaymentHistoryRecord[] {
  if (
    slotIndex == null ||
    !Number.isFinite(slotIndex) ||
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex > 7
  ) {
    return rows
  }
  const from = slotIndex * 3
  const to = from + 2
  return rows.filter((r) => {
    const h = parsePaidAt(r.paidAt).getHours()
    return h >= from && h <= to
  })
}

/** Yoğunluk filtresi için etiketler (yerel saat, ödemenin saat damgası). */
export const THREE_HOUR_SLOT_LABELS: readonly string[] = [
  '00:00–02:59',
  '03:00–05:59',
  '06:00–08:59',
  '09:00–11:59',
  '12:00–14:59',
  '15:00–17:59',
  '18:00–20:59',
  '21:00–23:59',
]

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

export type ListSortMode = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

export function sortPaymentRows(
  rows: CafePaymentHistoryRecord[],
  mode: ListSortMode,
): CafePaymentHistoryRecord[] {
  return [...rows].sort((a, b) => {
    switch (mode) {
      case 'date-desc':
        return parsePaidAt(b.paidAt).getTime() - parsePaidAt(a.paidAt).getTime()
      case 'date-asc':
        return parsePaidAt(a.paidAt).getTime() - parsePaidAt(b.paidAt).getTime()
      case 'amount-desc':
        return b.totalTry - a.totalTry
      case 'amount-asc':
        return a.totalTry - b.totalTry
      default:
        return 0
    }
  })
}

function normalizeSearch(s: string): string {
  return s.trim().toLocaleLowerCase('tr')
}

/** Masa no/adı veya satır ürün adında metin arar */
export function filterPaymentSearch(
  rows: CafePaymentHistoryRecord[],
  rawQuery: string,
): CafePaymentHistoryRecord[] {
  const q = normalizeSearch(rawQuery)
  if (!q) return rows
  return rows.filter((r) => {
    const nick = normalizeSearch(r.tableDisplayName ?? '')
    const numStr = String(r.tableNumber)
    const masaLabel = normalizeSearch(`masa ${r.tableNumber}`)
    if (numStr.includes(q) || masaLabel.includes(q) || nick.includes(q)) return true
    return r.lines.some((l) => normalizeSearch(l.name).includes(q))
  })
}

export function earningsInRange(
  rows: CafePaymentHistoryRecord[],
  rangeStart: Date,
  rangeEnd: Date,
): number {
  const a = rangeStart.getTime()
  const b = rangeEnd.getTime()
  let sum = 0
  for (const r of rows) {
    const t = parsePaidAt(r.paidAt).getTime()
    if (t >= a && t <= b) sum += r.totalTry
  }
  return sum
}

export function paymentCountsForKpis(
  rows: CafePaymentHistoryRecord[],
  now = new Date(),
): { day: number; week: number; month: number; year: number } {
  const ds = startOfLocalDay(now)
  const de = endOfLocalDay(now)
  const ws = startOfWeekMonday(now)
  const ms = startOfMonth(now)
  const ys = startOfYear(now)
  let day = 0
  let week = 0
  let month = 0
  let year = 0
  for (const r of rows) {
    const t = parsePaidAt(r.paidAt).getTime()
    if (t >= ds.getTime() && t <= de.getTime()) day += 1
    if (t >= ws.getTime() && t <= now.getTime()) week += 1
    if (t >= ms.getTime() && t <= now.getTime()) month += 1
    if (t >= ys.getTime() && t <= now.getTime()) year += 1
  }
  return { day, week, month, year }
}

export function earningsYesterday(rows: CafePaymentHistoryRecord[], now = new Date()): number {
  const y = new Date(now)
  y.setDate(y.getDate() - 1)
  return earningsInRange(rows, startOfLocalDay(y), endOfLocalDay(y))
}

/** Önceki haftanın aynı süresi (bu haftanın Pazartesi–şimdi uzunluğu) */
export function earningsPriorWeekSameSpan(rows: CafePaymentHistoryRecord[], now = new Date()): number {
  const weekStart = startOfWeekMonday(now)
  const span = now.getTime() - weekStart.getTime()
  const prevWeekStart = new Date(weekStart.getTime() - 7 * 86400000)
  const prevEnd = new Date(prevWeekStart.getTime() + span)
  return earningsInRange(rows, prevWeekStart, prevEnd)
}

/** Önceki ayın ay başından bugüne kadar olan süreye denk gelen ciro */
export function earningsPriorMonthSameSpan(rows: CafePaymentHistoryRecord[], now = new Date()): number {
  const monthStart = startOfMonth(now)
  const elapsed = now.getTime() - monthStart.getTime()
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevEnd = new Date(prevMonthStart.getTime() + elapsed)
  return earningsInRange(rows, prevMonthStart, prevEnd)
}

/** Geçen yılın aynı süresi (yıl başı–şimdi) */
export function earningsPriorYearSameSpan(rows: CafePaymentHistoryRecord[], now = new Date()): number {
  const ys = startOfYear(now)
  const elapsed = now.getTime() - ys.getTime()
  const prevYs = new Date(now.getFullYear() - 1, 0, 1)
  prevYs.setHours(0, 0, 0, 0)
  const prevEnd = new Date(prevYs.getTime() + elapsed)
  return earningsInRange(rows, prevYs, prevEnd)
}

export type PctBadge = { text: string; variant: 'up' | 'down' | 'neutral' }

export function formatPctBadge(current: number, previous: number): PctBadge | null {
  if (previous <= 0 && current <= 0) return null
  if (previous <= 0 && current > 0) return { text: 'Yeni', variant: 'up' }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return { text: '0%', variant: 'neutral' }
  return {
    text: `${pct > 0 ? '+' : ''}${pct}%`,
    variant: pct > 0 ? 'up' : 'down',
  }
}

export function peakHourRangeFromBuckets(buckets: HourBucket[]): string {
  const max = Math.max(0, ...buckets.map((b) => b.orderUnits))
  if (max === 0) return 'Veri yok'
  const thresh = max * 0.55
  const hours = buckets.filter((b) => b.orderUnits >= thresh).map((b) => b.hour)
  if (hours.length === 0) {
    const best = buckets.reduce((a, b) => (b.orderUnits > a.orderUnits ? b : a))
    return `${String(best.hour).padStart(2, '0')}:00`
  }
  const lo = Math.min(...hours)
  const hi = Math.max(...hours)
  if (lo === hi) return `${String(lo).padStart(2, '0')}:00`
  return `${String(lo).padStart(2, '0')}:00 – ${String(hi).padStart(2, '0')}:59`
}

const WEEKDAY_FULL_TR = [
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
  'Pazar',
] as const

export function peakWeekdayFromBuckets(buckets: WeekdayBucket[]): string {
  const max = Math.max(0, ...buckets.map((b) => b.orderUnits))
  if (max === 0) return 'Veri yok'
  const best = buckets.reduce((a, b) => (b.orderUnits > a.orderUnits ? b : a))
  return WEEKDAY_FULL_TR[best.weekdayIndex] ?? best.label
}

/** Son N gün (bugün dahil) içindeki ödemeler — yoğunluk kartı için */
export function filterLastNDays(
  rows: CafePaymentHistoryRecord[],
  days: number,
  now = new Date(),
): CafePaymentHistoryRecord[] {
  const start = startOfLocalDay(now)
  start.setDate(start.getDate() - (days - 1))
  return rows.filter((r) => parsePaidAt(r.paidAt).getTime() >= start.getTime())
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

/** Menüdeki tüm ürünleri satış rakamlarıyla birleştirir; menüde olmayan satışları sona ekler. */
export function mergeMenuWithSales(
  categories: CafeMenuCategory[],
  rows: CafePaymentHistoryRecord[],
): ProductAgg[] {
  const sales = aggregateProducts(rows)
  const salesMap = new Map(sales.map((s) => [s.key, s] as const))
  const seenMenu = new Set<string>()
  const out: ProductAgg[] = []

  const sortedCats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
  for (const c of sortedCats) {
    const items = [...c.items].sort((a, b) => a.sortOrder - b.sortOrder)
    for (const it of items) {
      seenMenu.add(it.id)
      const s = salesMap.get(it.id)
      out.push({
        key: it.id,
        name: it.name,
        qty: s?.qty ?? 0,
        revenue: s?.revenue ?? 0,
      })
    }
  }

  for (const s of sales) {
    if (!seenMenu.has(s.key)) {
      out.push({
        ...s,
        name: `${s.name} (menüde yok)`,
      })
    }
  }

  return out
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
