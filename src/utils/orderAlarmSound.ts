/** Misafir etkileşimi sonrası çalışır; sipariş bildirimi için tekrarlayan zil. */

let ctx: AudioContext | null = null
let intervalId: ReturnType<typeof setInterval> | null = null

function playDing(ac: AudioContext) {
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = 'sine'
  osc.connect(g)
  g.connect(ac.destination)
  osc.frequency.setValueAtTime(880, t)
  osc.frequency.exponentialRampToValueAtTime(440, t + 0.14)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.018)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42)
  osc.start(t)
  osc.stop(t + 0.45)

  const osc2 = ac.createOscillator()
  const g2 = ac.createGain()
  osc2.type = 'triangle'
  osc2.connect(g2)
  g2.connect(ac.destination)
  osc2.frequency.setValueAtTime(1320, t + 0.08)
  osc2.frequency.exponentialRampToValueAtTime(660, t + 0.22)
  g2.gain.setValueAtTime(0.0001, t + 0.08)
  g2.gain.exponentialRampToValueAtTime(0.12, t + 0.1)
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.38)
  osc2.start(t + 0.08)
  osc2.stop(t + 0.42)
}

export function startOrderAlarm(): void {
  stopOrderAlarm()
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return
  ctx = new Ctor()
  void ctx.resume().catch(() => {})
  const loop = () => {
    if (ctx?.state === 'suspended') void ctx.resume().catch(() => {})
    if (ctx) playDing(ctx)
  }
  loop()
  intervalId = window.setInterval(loop, 820)
}

export function stopOrderAlarm(): void {
  if (intervalId != null) {
    window.clearInterval(intervalId)
    intervalId = null
  }
  if (ctx) {
    void ctx.close().catch(() => {})
    ctx = null
  }
}
