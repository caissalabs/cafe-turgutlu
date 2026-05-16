import { supabase } from '@/lib/supabaseClient'

export const TABLE_QR_BUCKET = 'table-qr-codes'

export function tableQrStoragePath(businessId: string, tableId: number): string {
  return `${businessId}/${tableId}.png`
}

export function getTableQrPublicUrl(businessId: string, tableId: number): string {
  const path = tableQrStoragePath(businessId, tableId)
  const { data } = supabase.storage.from(TABLE_QR_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

function isAlreadyExistsStorageError(err: { message?: string; statusCode?: string }): boolean {
  const msg = (err.message ?? '').toLowerCase()
  if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('resource already')) {
    return true
  }
  return err.statusCode === '409'
}

/** Bucket’ta hangi masa numaralarının PNG’si var (dosya adı: `{id}.png`). */
export async function listTableQrTableIds(businessId: string): Promise<Set<number>> {
  const { data, error } = await supabase.storage.from(TABLE_QR_BUCKET).list(businessId, {
    limit: 100,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  })
  if (error) {
    console.error(error)
    return new Set()
  }
  const ids = new Set<number>()
  for (const f of data ?? []) {
    const m = /^(\d+)\.png$/i.exec(f.name)
    if (m) ids.add(Number(m[1]))
  }
  return ids
}

/** İlk yükleme: aynı yol varsa hata yutulur (tek seferlik). */
export async function uploadTableQrIfAbsent(
  businessId: string,
  tableId: number,
  blob: Blob,
): Promise<'uploaded' | 'skipped'> {
  const path = tableQrStoragePath(businessId, tableId)
  const { error } = await supabase.storage.from(TABLE_QR_BUCKET).upload(path, blob, {
    contentType: 'image/png',
    upsert: false,
    cacheControl: '31536000',
  })
  if (!error) return 'uploaded'
  if (isAlreadyExistsStorageError(error)) return 'skipped'
  throw error
}
