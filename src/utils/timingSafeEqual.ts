/** Sabit süreli karşılaştırma (istemeden sızan bilgiyi azaltır). */
export function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  if (left.length !== right.length) {
    return false
  }
  let diff = 0
  for (let i = 0; i < left.length; i++) {
    diff |= left[i] ^ right[i]
  }
  return diff === 0
}
