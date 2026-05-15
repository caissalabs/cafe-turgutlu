/**
 * Ödeme alındı — `public/audio/cash-register.mp3` (Vite: kök URL `/audio/cash-register.mp3`).
 */

const base = import.meta.env.BASE_URL
const CASH_REGISTER_URL = base.endsWith('/')
  ? `${base}audio/cash-register.mp3`
  : `${base}/audio/cash-register.mp3`

let audio: HTMLAudioElement | null = null

function getCashAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(CASH_REGISTER_URL)
    audio.preload = 'auto'
  }
  return audio
}

/** Ödeme onayına basıldığında (kullanıcı jesti ile aynı yığıında) çağrılmalı. */
export function playCashRegisterSound(): void {
  const el = getCashAudio()
  try {
    el.pause()
    el.currentTime = 0
  } catch {
    /* bazı tarayıcılar henüz yüklenmemiş offset’te hata verebilir */
  }
  void el.play().catch(() => {})
}

/** İlk dokunuşta decode / yükleme (özellikle mobil). */
export function unlockCashRegisterAudio(): void {
  const el = getCashAudio()
  void el.load()
}
