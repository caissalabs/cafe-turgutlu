const HHMM =
  /^([01]?\d|2[0-3]):([0-5]\d)$/

/** DB / API'den gelen time → <input type="time"> (HH:mm) */
export function timeToInputValue(raw: string | null | undefined): string {
  if (raw == null || raw === '') return ''
  const s = raw.trim()
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s)
  if (!m) return ''
  const h = m[1]!.padStart(2, '0')
  const min = m[2]!.padStart(2, '0')
  return `${h}:${min}`
}

export type BusinessHoursParsed =
  | { ok: true; openingTime: string | null; closingTime: string | null }
  | { ok: false; error: string }

/** Postgres `time` — ikisi birden dolu ya da ikisi birden boş olmalı. */
export function parseBusinessHoursForRpc(open: string, close: string): BusinessHoursParsed {
  const a = open.trim()
  const b = close.trim()

  if (!a && !b) {
    return { ok: true, openingTime: null, closingTime: null }
  }
  if (!a || !b) {
    return {
      ok: false,
      error: 'Açılış ve kapanış saatini birlikte girin ya da ikisini boş bırakın.',
    }
  }
  if (!HHMM.test(a) || !HHMM.test(b)) {
    return { ok: false, error: 'Saatleri HH:MM formatında seçin.' }
  }
  if (a === b) {
    return { ok: false, error: 'Açılış ve kapanış saatleri farklı olmalıdır.' }
  }

  const pad = (raw: string) => {
    const [h, m] = raw.split(':')
    return `${h!.padStart(2, '0')}:${m!.padStart(2, '0')}:00`
  }

  return { ok: true, openingTime: pad(a), closingTime: pad(b) }
}
