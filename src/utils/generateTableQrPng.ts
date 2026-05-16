import QRCode from 'qrcode'

/** Yüksek kontrast, tarayıcıda taranabilir PNG (Python script’e yakın ayarlar). */
export async function generateTableQrPngBlob(menuUrl: string): Promise<Blob> {
  const dataUrl = await QRCode.toDataURL(menuUrl.trim(), {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    margin: 4,
    width: 560,
    color: { dark: '#000000ff', light: '#ffffffff' },
  })
  const res = await fetch(dataUrl)
  return await res.blob()
}
