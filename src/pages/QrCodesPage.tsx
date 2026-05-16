import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { useAuth } from '@/hooks/useAuth'
import { useCafeTables } from '@/hooks/useCafeTables'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  getTableQrPublicUrl,
  listTableQrTableIds,
  uploadTableQrIfAbsent,
} from '@/services/qrCodesRepository'
import { buildTableMenuQrUrl, getPublicAppOrigin } from '@/utils/publicAppOrigin'
import { generateTableQrPngBlob } from '@/utils/generateTableQrPng'
import { tableDisplayLabel } from '@/constants/tables'
import styles from './QrCodesPage.module.css'

export function QrCodesPage() {
  useDocumentTitle('CafeNET — QR kodları')
  const { businessId } = useAuth()
  const cafe = useCafeTables(businessId)
  const { tables, tablesLoading } = cafe

  const tableKey = useMemo(() => tables.map((t) => t.id).join(','), [tables])

  const tablesRef = useRef(tables)
  tablesRef.current = tables

  const [existingTables, setExistingTables] = useState<Set<number>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [cacheBust, setCacheBust] = useState(0)
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!businessId || tablesLoading) return
    const bid = businessId
    const tablesNow = tablesRef.current
    if (tablesNow.length === 0) {
      setExistingTables(new Set())
      return
    }

    let cancelled = false

    async function sync() {
      setGenerating(true)
      try {
        let known = await listTableQrTableIds(bid)
        if (cancelled) return
        setExistingTables(new Set(known))
        setCacheBust((n) => n + 1)

        for (const t of tablesNow) {
          if (cancelled) return
          if (known.has(t.id)) continue

          setRowErrors((prev) => {
            const next = { ...prev }
            delete next[t.id]
            return next
          })

          try {
            const menuUrl = buildTableMenuQrUrl(bid, t.id)
            const blob = await generateTableQrPngBlob(menuUrl)
            await uploadTableQrIfAbsent(bid, t.id, blob)
            known = new Set(known).add(t.id)
            setExistingTables(new Set(known))
            setCacheBust((n) => n + 1)
          } catch (e) {
            console.error(e)
            const msg =
              e instanceof Error
                ? e.message
                : 'QR oluşturulurken veya yüklenirken hata oluştu.'
            setRowErrors((prev) => ({ ...prev, [t.id]: msg }))
          }
        }
      } finally {
        if (!cancelled) setGenerating(false)
      }
    }

    void sync()

    return () => {
      cancelled = true
    }
  }, [businessId, tablesLoading, tableKey])

  const handleDownload = useCallback(
    async (tableId: number, label: string) => {
      if (!businessId) return
      const url = `${getTableQrPublicUrl(businessId, tableId)}?v=${cacheBust}`
      const res = await fetch(url)
      if (!res.ok) return
      const blob = await res.blob()
      const a = document.createElement('a')
      const safe = label.replace(/[^\w\u00C0-\u024f-]+/gi, '-').replace(/^-|-$/g, '')
      a.href = URL.createObjectURL(blob)
      a.download = `qr-${safe || 'masa'}-${tableId}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    },
    [businessId, cacheBust],
  )

  if (!businessId) {
    return <p className={styles.lead}>İşletme bilgisi yok.</p>
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>QR kodlarım</h1>
      <p className={styles.lead}>
        Her masa için menü bağlantısı tek sefer üretilir ve güvenli depoda saklanır. Yeni masa eklediğinizde
        bu sayfayı açtığınızda eksik kodlar otomatik oluşturulur.
      </p>

      <div className={styles.originHint}>
        QR içindeki adres kökü: <code>{getPublicAppOrigin() || '(bilinmiyor)'}</code>
        {' — '}
        Üretimde doğru alan adı için <code>VITE_SITE_URL</code> kullanın.
      </div>

      {tablesLoading ? (
        <p className={styles.spin}>Masalar yükleniyor…</p>
      ) : tables.length === 0 ? (
        <p className={styles.placeholder}>Henüz masa tanımlı değil.</p>
      ) : (
        <>
          {generating ? (
            <p className={styles.spin}>Eksik QR kodları hazırlanıyor…</p>
          ) : null}
          <div className={styles.grid}>
            {tables.map((t) => {
              const label = tableDisplayLabel(t)
              const ready = existingTables.has(t.id)
              const url = buildTableMenuQrUrl(businessId, t.id)
              const pub = `${getTableQrPublicUrl(businessId, t.id)}?v=${cacheBust}`
              const err = rowErrors[t.id]

              return (
                <article key={t.id} className={styles.card}>
                  <h2 className={styles.cardTitle}>{label}</h2>
                  <div className={styles.qrFrame}>
                    {ready ? (
                      <img src={pub} alt={`${label} menü QR kodu`} loading="lazy" />
                    ) : (
                      <span className={styles.placeholder}>Oluşturuluyor…</span>
                    )}
                  </div>
                  <p className={styles.urlMini}>{url}</p>
                  {err ? (
                    <p className={styles.error} role="alert">
                      {err}
                    </p>
                  ) : null}
                  <div className={styles.actions}>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!ready}
                      onClick={() => void handleDownload(t.id, label)}
                    >
                      PNG indir
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!ready}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(url)
                        } catch {
                          /* ignore */
                        }
                      }}
                    >
                      Linki kopyala
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
