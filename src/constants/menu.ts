/** Sadece para birimi biçimlendirme — menü içeriği veritabanından gelir. */
export function formatPriceTry(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount)
}
