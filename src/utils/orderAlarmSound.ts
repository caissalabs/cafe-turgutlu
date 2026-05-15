/**
 * Yeni sipariş bildirimi — `public/audio/new-order-notification.mp3`, döngü.
 * HTMLAudioElement Realtime ile gelince çoğu tarayıcıda autoplay engeline takılır;
 * kullanıcı etkileşiminde unlock + önbelleğe decode sonrası AudioBufferSource (loop) kullanılır.
 */

const base = import.meta.env.BASE_URL
const NOTIFICATION_LOOP_URL = base.endsWith('/')
  ? `${base}audio/new-order-notification.mp3`
  : `${base}/audio/new-order-notification.mp3`

function getAudioCtor(): typeof AudioContext | null {
  const w = window as unknown as {
    AudioContext?: typeof AudioContext
    webkitAudioContext?: typeof AudioContext
  }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

let ctx: AudioContext | null = null
let decodedBuffer: AudioBuffer | null = null
let decodePromise: Promise<AudioBuffer | null> | null = null
let wantPlaying = false
let retryIntervalId: ReturnType<typeof setInterval> | null = null
let activeSource: AudioBufferSourceNode | null = null
let activeGain: GainNode | null = null

function clearRetryInterval(): void {
  if (retryIntervalId != null) {
    window.clearInterval(retryIntervalId)
    retryIntervalId = null
  }
}

function getContext(): AudioContext | null {
  const Ctor = getAudioCtor()
  if (!Ctor) return null
  if (ctx?.state === 'closed') ctx = null
  if (!ctx) ctx = new Ctor()
  return ctx
}

function stopPlaybackGraph(): void {
  if (activeSource) {
    try {
      activeSource.stop(0)
    } catch {
      /* zaten durmuş olabilir */
    }
    try {
      activeSource.disconnect()
    } catch {
      /* */
    }
    activeSource = null
  }
  if (activeGain) {
    try {
      activeGain.disconnect()
    } catch {
      /* */
    }
    activeGain = null
  }
}

function startPlaybackGraph(ac: AudioContext, buffer: AudioBuffer): void {
  if (!wantPlaying) return
  stopPlaybackGraph()

  const gain = ac.createGain()
  gain.gain.value = 0.92
  gain.connect(ac.destination)

  const src = ac.createBufferSource()
  src.buffer = buffer
  src.loop = true
  src.connect(gain)
  src.start(0)

  activeGain = gain
  activeSource = src
}

function tryStartAfterUnlock(): void {
  const ac = getContext()
  if (!ac || !wantPlaying || !decodedBuffer) return
  if (ac.state !== 'running') return
  startPlaybackGraph(ac, decodedBuffer)
}

async function ensureDecoded(): Promise<AudioBuffer | null> {
  if (decodedBuffer) return decodedBuffer
  if (decodePromise) return decodePromise

  decodePromise = (async () => {
    const ac = getContext()
    if (!ac) return null
    try {
      const res = await fetch(NOTIFICATION_LOOP_URL)
      if (!res.ok) return null
      const raw = await res.arrayBuffer()
      const buffer = await ac.decodeAudioData(raw.slice(0))
      decodedBuffer = buffer
      return buffer
    } catch {
      return null
    } finally {
      decodePromise = null
    }
  })()

  return decodePromise
}

/** İlk dokunuşta bağlam + decode (yönetici panele girince zil hazır olur). */
export function unlockNewOrderNotificationAudio(): void {
  const ac = getContext()
  if (!ac) return
  void ac.resume().catch(() => {})
  void ensureDecoded().then(() => {
    if (wantPlaying) tryStartAfterUnlock()
  })
}

export function startOrderAlarm(): void {
  stopOrderAlarm()
  wantPlaying = true

  const ac = getContext()
  if (!ac) return

  const attempt = (): void => {
    if (!wantPlaying) return
    void ac.resume().catch(() => {})
    tryStartAfterUnlock()
  }

  attempt()
  void ensureDecoded().then(() => {
    attempt()
  })

  clearRetryInterval()
  let ticks = 0
  retryIntervalId = window.setInterval(() => {
    if (!wantPlaying || activeSource) {
      clearRetryInterval()
      return
    }
    if (ticks++ > 120) {
      clearRetryInterval()
      return
    }
    attempt()
  }, 250)
}

export function stopOrderAlarm(): void {
  wantPlaying = false
  clearRetryInterval()
  stopPlaybackGraph()
}
