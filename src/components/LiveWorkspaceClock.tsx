import { useEffect, useState } from 'react'
import { cn } from '@/utils/cn'
import styles from './LiveWorkspaceClock.module.css'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** ISO hafta numarası (Pazartesi başlangıçlı hafta, yerel tarih). */
function isoWeekNumber(d: Date): number {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - day + 3)
  const firstThursday = date.getTime()
  date.setMonth(0, 1)
  if (date.getDay() !== 4) {
    date.setMonth(0, 1 + ((4 - date.getDay() + 7) % 7))
  }
  return 1 + Math.round((firstThursday - date.getTime()) / 604800000)
}

function capitalizeTr(s: string): string {
  if (!s) return s
  const first = s.charAt(0).toLocaleUpperCase('tr')
  return first + s.slice(1)
}

export type LiveWorkspaceClockProps = {
  /** Başlık satırına sığdırmak için daha sıkı dikey boşluklar */
  variant?: 'default' | 'compact' | 'dense'
}

/** Panel üstünde Türkçe saat · tarih · hafta/ay özeti — canlı saniye ile güncellenir. */
export function LiveWorkspaceClock({ variant = 'default' }: LiveWorkspaceClockProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()

    /** Saniye güncellemesi bilgilendirici; reduced-motion ile iptal etmeyin (sayılar “donuyor” sanılır). */
    const id = window.setInterval(tick, 1000)

    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const hh = pad2(now.getHours())
  const mm = pad2(now.getMinutes())
  const ss = pad2(now.getSeconds())

  const day = pad2(now.getDate())
  const month = pad2(now.getMonth() + 1)
  const year = now.getFullYear()
  const weekday = capitalizeTr(
    new Intl.DateTimeFormat('tr-TR', { weekday: 'long' }).format(now),
  )

  const week = isoWeekNumber(now)

  return (
    <div
      className={cn(
        styles.strip,
        variant === 'compact' && styles.stripCompact,
        variant === 'dense' && styles.stripDense,
      )}
      aria-label="Şu anki tarih ve saat"
    >
      <div className={styles.clockRow}>
        <span className={cn('material-symbols-outlined', styles.clockIcon)} aria-hidden>
          schedule
        </span>
        <p className={styles.time}>
          <time dateTime={`${year}-${month}-${day}T${hh}:${mm}:${ss}`}>
            {hh}:{mm}:{ss}
          </time>
        </p>
      </div>
      <div className={styles.dateRow}>
        <span className={cn('material-symbols-outlined', styles.calendarIcon)} aria-hidden>
          calendar_today
        </span>
        <p className={styles.dateText}>
          <time dateTime={`${year}-${month}-${day}`}>
            {day}.{month}.{year}
          </time>
          {' — '}
          {weekday}
        </p>
      </div>
      <p className={styles.meta}>
        <span>{week}. Hafta</span>
        <span className={styles.metaDot} aria-hidden />
        <span>
          {now.getMonth() + 1}. Ay {year}
        </span>
      </p>
    </div>
  )
}
